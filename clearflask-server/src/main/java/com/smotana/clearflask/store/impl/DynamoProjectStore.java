package com.smotana.clearflask.store.impl;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.document.DynamoDB;
import com.amazonaws.services.dynamodbv2.document.PrimaryKey;
import com.amazonaws.services.dynamodbv2.document.RangeKeyCondition;
import com.amazonaws.services.dynamodbv2.document.TableKeysAndAttributes;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.spec.BatchGetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.DeleteItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.GetItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.PutItemSpec;
import com.amazonaws.services.dynamodbv2.document.spec.QuerySpec;
import com.amazonaws.services.dynamodbv2.document.spec.UpdateItemSpec;
import com.amazonaws.services.dynamodbv2.document.utils.NameMap;
import com.amazonaws.services.dynamodbv2.document.utils.ValueMap;
import com.amazonaws.services.dynamodbv2.model.CancellationReason;
import com.amazonaws.services.dynamodbv2.model.ConditionalCheckFailedException;
import com.amazonaws.services.dynamodbv2.model.Put;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItem;
import com.amazonaws.services.dynamodbv2.model.TransactWriteItemsRequest;
import com.amazonaws.services.dynamodbv2.model.TransactionCanceledException;
import com.google.common.base.Strings;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableSet;
import com.google.common.collect.Iterables;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;
import com.google.gson.Gson;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.Category;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.api.model.Expressing;
import com.smotana.clearflask.api.model.Expression;
import com.smotana.clearflask.api.model.IdeaStatus;
import com.smotana.clearflask.api.model.VersionedConfig;
import com.smotana.clearflask.api.model.VersionedConfigAdmin;
import com.smotana.clearflask.api.model.Voting;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.ProjectStore.WebhookListener.ResourceType;
import com.smotana.clearflask.store.VoteStore.VoteValue;
import com.smotana.clearflask.store.dynamo.DynamoUtil;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.IndexSchema;
import com.smotana.clearflask.store.dynamo.mapper.DynamoMapper.TableSchema;
import com.smotana.clearflask.util.ConfigSchemaUpgrader;
import com.smotana.clearflask.util.Extern;
import com.smotana.clearflask.util.IntercomUtil;
import com.smotana.clearflask.util.LogUtil;
import com.smotana.clearflask.util.StringSerdeUtil;
import com.smotana.clearflask.web.ApiException;
import com.smotana.clearflask.web.Application;
import com.smotana.clearflask.web.security.Sanitizer;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

import javax.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static com.smotana.clearflask.store.dynamo.DefaultDynamoDbProvider.DYNAMO_WRITE_BATCH_MAX_SIZE;

@Slf4j
@Singleton
public class DynamoProjectStore implements ProjectStore {

    public interface Config {
        @DefaultValue("true")
        boolean enableSlugCacheRead();

        @DefaultValue("PT1H")
        Duration slugCacheExpireAfterWrite();

        /**
         * During slug migration, how long to keep the old slug before releasing.
         * If changed, update documentation including in api-project.yaml.
         */
        @DefaultValue("P1D")
        Duration slugExpireAfterMigration();

        @DefaultValue("true")
        boolean enableConfigCacheRead();

        @DefaultValue("PT1M")
        Duration configCacheExpireAfterWrite();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private AmazonDynamoDB dynamo;
    @Inject
    private DynamoDB dynamoDoc;
    @Inject
    private DynamoMapper dynamoMapper;
    @Inject
    private DynamoUtil dynamoUtil;
    @Inject
    private Gson gson;
    @Inject
    private Sanitizer sanitizer;
    @Inject
    private ConfigSchemaUpgrader configSchemaUpgrader;
    @Inject
    private IntercomUtil intercomUtil;

    private TableSchema<ProjectModel> projectSchema;
    private TableSchema<SlugModel> slugSchema;
    private IndexSchema<SlugModel> slugByProjectSchema;
    private Cache<String, String> slugCache;
    private Cache<String, Optional<Project>> projectCache;

    @Inject
    private void setup() {
        slugCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.slugCacheExpireAfterWrite())
                .build();
        projectCache = CacheBuilder.newBuilder()
                .expireAfterWrite(config.configCacheExpireAfterWrite())
                .build();

        projectSchema = dynamoMapper.parseTableSchema(ProjectModel.class);
        slugSchema = dynamoMapper.parseTableSchema(SlugModel.class);
        slugByProjectSchema = dynamoMapper.parseGlobalSecondaryIndexSchema(2, SlugModel.class);
    }

    @Extern
    @Override
    public Optional<Project> getProjectBySlug(String slug, boolean useCache) {
        if (config.enableSlugCacheRead() && useCache) {
            final String projectId = slugCache.getIfPresent(slug);
            if (projectId != null) {
                return getProject(projectId, useCache);
            }
        }
        Optional<String> projectIdOpt = Optional.ofNullable(slugSchema.fromItem(slugSchema.table()
                .getItem(new GetItemSpec()
                        .withPrimaryKey(slugSchema
                                .primaryKey(Map.of("slug", slug))))))
                .map(SlugModel::getProjectId);
        projectIdOpt.ifPresent(projectId -> slugCache.put(slug, projectId));
        return projectIdOpt.flatMap(projectId -> getProject(projectId, useCache));
    }

    @Extern
    @Override
    public Optional<Project> getProject(String projectId, boolean useCache) {
        if (config.enableConfigCacheRead() && useCache) {
            final Optional<Project> projectCachedOpt = projectCache.getIfPresent(projectId);
            //noinspection OptionalAssignedToNull
            if (projectCachedOpt != null) {
                return projectCachedOpt;
            }
        }
        Optional<Project> projectOpt = Optional.ofNullable(projectSchema.fromItem(projectSchema.table()
                .getItem(new GetItemSpec()
                        .withPrimaryKey(projectSchema
                                .primaryKey(Map.of("projectId", projectId))))))
                .map(this::getProjectWithUpgrade);
        projectCache.put(projectId, projectOpt);
        return projectOpt;
    }

    @Override
    public ImmutableSet<Project> getProjects(ImmutableSet<String> projectIds, boolean useCache) {
        if (projectIds.isEmpty()) {
            return ImmutableSet.of();
        }
        ImmutableSet<Project> projects = dynamoUtil.retryUnprocessed(dynamoDoc.batchGetItem(new BatchGetItemSpec()
                .withTableKeyAndAttributes(new TableKeysAndAttributes(projectSchema.tableName())
                        .withConsistentRead(!useCache)
                        .withPrimaryKeys(projectIds.stream()
                                .map(projectId -> projectSchema.primaryKey(Map.of("projectId", projectId)))
                                .toArray(PrimaryKey[]::new)))))
                .map(projectSchema::fromItem)
                .map(this::getProjectWithUpgrade)
                .collect(ImmutableSet.toImmutableSet());
        projects.forEach(project -> projectCache.put(project.getProjectId(), Optional.of(project)));
        return projects;
    }

    @Override
    public Project createProject(String accountId, String projectId, VersionedConfigAdmin versionedConfigAdmin) {
        String subdomain = versionedConfigAdmin.getConfig().getSlug();
        Optional<String> domainOpt = Optional.ofNullable(Strings.emptyToNull(versionedConfigAdmin.getConfig().getDomain()));
        ProjectModel projectModel = new ProjectModel(
                accountId,
                projectId,
                versionedConfigAdmin.getVersion(),
                versionedConfigAdmin.getConfig().getSchemaVersion(),
                ImmutableSet.of(),
                gson.toJson(versionedConfigAdmin.getConfig()));
        try {
            ImmutableList.Builder<TransactWriteItem> transactionsBuilder = ImmutableList.<TransactWriteItem>builder()
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(slugSchema.tableName())
                            .withItem(slugSchema.toAttrMap(new SlugModel(
                                    subdomain,
                                    projectId,
                                    null)))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", slugSchema.partitionKeyName()))))
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(projectSchema.tableName())
                            .withItem(projectSchema.toAttrMap(projectModel))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", projectSchema.partitionKeyName()))));
            domainOpt.ifPresent(domain -> transactionsBuilder
                    .add(new TransactWriteItem().withPut(new Put()
                            .withTableName(slugSchema.tableName())
                            .withItem(slugSchema.toAttrMap(new SlugModel(
                                    domain,
                                    projectId,
                                    null)))
                            .withConditionExpression("attribute_not_exists(#partitionKey)")
                            .withExpressionAttributeNames(ImmutableMap.of("#partitionKey", slugSchema.partitionKeyName())))));
            dynamo.transactWriteItems(new TransactWriteItemsRequest().withTransactItems(
                    transactionsBuilder.build()));
        } catch (TransactionCanceledException ex) {
            if (ex.getCancellationReasons().stream().map(CancellationReason::getCode).anyMatch("ConditionalCheckFailed"::equals)) {
                throw new ApiException(Response.Status.CONFLICT, "Project name already taken, please choose another.", ex);
            }
            throw ex;
        }
        ProjectImpl project = new ProjectImpl(projectModel);
        projectCache.put(projectId, Optional.of(project));
        slugCache.put(subdomain, projectId);
        domainOpt.ifPresent(domain -> slugCache.put(domain, projectId));
        return project;
    }

    @Override
    public void updateConfig(String projectId, Optional<String> previousVersionOpt, VersionedConfigAdmin versionedConfigAdmin) {
        Project project = getProject(projectId, false).get();

        ImmutableMap.Builder<String, String> slugsToChangeBuilder = ImmutableMap.builder();

        Optional<String> domainPreviousOpt = Optional.ofNullable(Strings.emptyToNull(project.getVersionedConfigAdmin().getConfig().getDomain()));
        Optional<String> domainOpt = Optional.ofNullable(Strings.emptyToNull(versionedConfigAdmin.getConfig().getDomain()));
        if (!domainOpt.equals(domainPreviousOpt)) {
            domainOpt.ifPresent(s -> sanitizer.domain(s));
            slugsToChangeBuilder.put(domainPreviousOpt.orElse(""), domainOpt.orElse(""));
        }

        String subdomainPrevious = project.getVersionedConfigAdmin().getConfig().getSlug();
        String subdomain = versionedConfigAdmin.getConfig().getSlug();
        if (!subdomain.equals(subdomainPrevious)) {
            sanitizer.subdomain(subdomain);
            slugsToChangeBuilder.put(subdomainPrevious, subdomain);
        }

        ImmutableMap<String, String> slugsToChange = slugsToChangeBuilder.build();

        slugsToChange.forEach((slugFrom, slugTo) -> {
            if (LogUtil.rateLimitAllowLog("projectStore-slugChange")) {
                log.info("Project {} changing slug from '{}' to '{}'", projectId, slugFrom, slugTo);
            }
            if (Strings.isNullOrEmpty(slugTo)) {
                return;
            }
            try {
                slugSchema.table().putItem(new PutItemSpec()
                        .withItem(slugSchema.toItem(new SlugModel(slugTo, projectId, null)))
                        // Allow changing your mind and rollback slug if slug still exists part of migration
                        .withConditionExpression("attribute_not_exists(#partitionKey) OR (attribute_exists(#partitionKey) AND #projectId = :projectId)")
                        .withNameMap(Map.of(
                                "#partitionKey", slugSchema.partitionKeyName(),
                                "#projectId", "projectId"))
                        .withValueMap(Map.of(
                                ":projectId", projectId)));
                slugCache.invalidate(slugTo);
            } catch (ConditionalCheckFailedException ex) {
                throw new ApiException(Response.Status.CONFLICT, "Slug is already taken, please choose another.", ex);
            }
        });
        try {
            HashMap<String, String> nameMap = Maps.newHashMap();
            HashMap<String, Object> valMap = Maps.newHashMap();
            List<String> setUpdates = Lists.newArrayList();
            Optional<String> conditionExpressionOpt = Optional.empty();

            nameMap.put("#configJson", "configJson");
            valMap.put(":configJson", gson.toJson(versionedConfigAdmin.getConfig()));
            setUpdates.add("#configJson = :configJson");

            nameMap.put("#version", "version");
            valMap.put(":version", versionedConfigAdmin.getVersion());
            setUpdates.add("#version = :version");

            nameMap.put("#schemaVersion", "schemaVersion");
            valMap.put(":schemaVersion", versionedConfigAdmin.getConfig().getSchemaVersion());
            setUpdates.add("#schemaVersion = :schemaVersion");

            if (previousVersionOpt.isPresent()) {
                valMap.put(":previousVersion", previousVersionOpt.get());
                conditionExpressionOpt = Optional.of("#version = :previousVersion");
            }

            String updateExpression = "SET " + String.join(", ", setUpdates);
            log.trace("updateConfig with expression: {} {} {}", updateExpression, nameMap, valMap);

            projectSchema.table().updateItem(new UpdateItemSpec()
                    .withPrimaryKey(projectSchema.primaryKey(Map.of(
                            "projectId", projectId)))
                    .withNameMap(nameMap)
                    .withValueMap(valMap)
                    .withUpdateExpression(updateExpression)
                    .withConditionExpression(conditionExpressionOpt.orElse(null)));
        } catch (ConditionalCheckFailedException ex) {
            slugsToChange.forEach((slugFrom, slugTo) -> {
                if (Strings.isNullOrEmpty(slugTo)) {
                    return;
                }
                // Undo creating slug just now
                slugSchema.table()
                        .deleteItem(new DeleteItemSpec()
                                .withConditionExpression("attribute_exists(#partitionKey) AND #projectId = :projectId")
                                .withNameMap(Map.of(
                                        "#partitionKey", slugSchema.partitionKeyName(),
                                        "#projectId", "projectId"))
                                .withValueMap(Map.of(
                                        ":projectId", projectId))
                                .withPrimaryKey(slugSchema.primaryKey(ImmutableMap.of(
                                        "slug", slugTo))));
                slugCache.invalidate(slugTo);
            });
            throw new ApiException(Response.Status.CONFLICT, "Project was modified by someone else while you were editing. Cannot merge changes.", ex);
        }
        slugsToChange.forEach((slugFrom, slugTo) -> {
            if (Strings.isNullOrEmpty(slugFrom)) {
                return;
            }
            try {
                slugSchema.table()
                        .putItem(new PutItemSpec()
                                .withConditionExpression("attribute_exists(#partitionKey) AND #projectId = :projectId")
                                .withNameMap(Map.of(
                                        "#partitionKey", slugSchema.partitionKeyName(),
                                        "#projectId", "projectId"))
                                .withValueMap(Map.of(
                                        ":projectId", projectId))
                                .withItem(slugSchema.toItem(new SlugModel(
                                        slugFrom,
                                        projectId,
                                        Instant.now().plus(config.slugExpireAfterMigration()).getEpochSecond()))));
                slugCache.invalidate(slugFrom);
            } catch (ConditionalCheckFailedException ex) {
                log.warn("Updating slug, but previous slug '{}' already doesn't exist?, switching to '{}'", slugFrom, slugTo, ex);
            }
        });
        projectCache.invalidate(projectId);
    }

    @Override
    public void addWebhookListener(String projectId, WebhookListener listener) {
        updateWebhookListener(projectId, listener, true);
    }

    @Override
    public void removeWebhookListener(String projectId, WebhookListener listener) {
        updateWebhookListener(projectId, listener, false);
    }

    private void updateWebhookListener(String projectId, WebhookListener listener, boolean set) {
        projectSchema.table().updateItem(new UpdateItemSpec()
                .withPrimaryKey(projectSchema.primaryKey(Map.of("projectId", projectId)))
                .withConditionExpression("attribute_exists(#partitionKey)")
                .withUpdateExpression((set ? "ADD" : "DELETE") + " #webhookListeners :webhookListener")
                .withNameMap(new NameMap()
                        .with("#webhookListeners", "webhookListeners")
                        .with("#partitionKey", projectSchema.partitionKeyName()))
                .withValueMap(new ValueMap().withStringSet(":webhookListener", packWebhookListener(listener)))
                .withReturnValues(ReturnValue.ALL_NEW));
        projectCache.invalidate(projectId);
    }

    @Extern
    @Override
    public void deleteProject(String projectId) {
        // Delete project
        projectSchema.table().deleteItem(new DeleteItemSpec()
                .withPrimaryKey(projectSchema.primaryKey(ImmutableMap.of(
                        "projectId", projectId))));
        projectCache.invalidate(projectId);

        // Delete Slug
        Iterables.partition(StreamSupport.stream(slugByProjectSchema.index().query(new QuerySpec()
                .withHashKey(slugByProjectSchema.partitionKey(Map.of(
                        "projectId", projectId)))
                .withRangeKeyCondition(new RangeKeyCondition(slugByProjectSchema.rangeKeyName())
                        .beginsWith(slugByProjectSchema.rangeValuePartial(Map.of()))))
                .pages()
                .spliterator(), false)
                .flatMap(p -> StreamSupport.stream(p.spliterator(), false))
                .map(slugByProjectSchema::fromItem)
                .filter(slug -> projectId.equals(slug.getProjectId()))
                .collect(ImmutableSet.toImmutableSet()), DYNAMO_WRITE_BATCH_MAX_SIZE)
                .forEach(slugsBatch -> {
                    slugCache.invalidateAll(slugsBatch);
                    TableWriteItems tableWriteItems = new TableWriteItems(slugSchema.tableName());
                    slugsBatch.stream()
                            .map(slug -> slugSchema.primaryKey(Map.of(
                                    "slug", slug)))
                            .forEach(tableWriteItems::addPrimaryKeyToDelete);
                    dynamoUtil.retryUnprocessed(dynamoDoc.batchWriteItem(tableWriteItems));
                });
    }

    private String packWebhookListener(WebhookListener listener) {
        return StringSerdeUtil.mergeStrings(listener.getResourceType().name(), listener.getEventType(), listener.getUrl());
    }

    private Optional<WebhookListener> unpackWebhookListener(String listenerStr) {
        String[] listenerParts = StringSerdeUtil.unMergeString(listenerStr);
        if (listenerParts.length != 3) {
            return Optional.empty();
        }
        return Optional.of(new WebhookListener(
                ResourceType.valueOf(listenerParts[0]),
                listenerParts[1],
                listenerParts[2]));
    }

    private Project getProjectWithUpgrade(ProjectModel projectModel) {
        Optional<String> configUpgradedOpt = configSchemaUpgrader.upgrade(projectModel.getConfigJson());

        if (configUpgradedOpt.isPresent()) {
            projectModel = projectModel.toBuilder()
                    .configJson(configUpgradedOpt.get())
                    .build();

            try {
                projectSchema.table().putItem(new PutItemSpec()
                        .withItem(projectSchema.toItem(projectModel))
                        .withConditionExpression("#version = :version")
                        .withNameMap(Map.of("#version", "version"))
                        .withValueMap(Map.of(":version", projectModel.getVersion())));
            } catch (ConditionalCheckFailedException ex) {
                log.warn("Writing upgraded project failed, will let someone else upgrade it later", ex);
            }
            projectCache.invalidate(projectModel.getProjectId());
        }

        return new ProjectImpl(projectModel);
    }

    @EqualsAndHashCode(of = {"accountId", "projectId", "version"})
    @ToString(of = {"accountId", "projectId", "version"})
    private class ProjectImpl implements Project {
        private static final double EXPRESSION_WEIGHT_DEFAULT = 1d;
        private final ProjectModel model;
        private final String accountId;
        private final String projectId;
        private final String version;
        private final VersionedConfig versionedConfig;
        private final VersionedConfigAdmin versionedConfigAdmin;
        private final ImmutableMap<String, ImmutableMap<String, Double>> categoryExpressionToWeight;
        private final ImmutableMap<String, Category> categories;
        private final ImmutableMap<String, IdeaStatus> statuses;
        private final Function<String, String> intercomEmailToIdentityFun;
        private final ImmutableMap<String, ImmutableSet<WebhookListener>> webhookEventToListeners;

        private ProjectImpl(ProjectModel projectModel) {
            this.model = projectModel;
            this.accountId = projectModel.getAccountId();
            this.projectId = projectModel.getProjectId();
            this.version = projectModel.getVersion();
            this.versionedConfig = new VersionedConfig(gson.fromJson(projectModel.getConfigJson(), com.smotana.clearflask.api.model.Config.class), projectModel.getVersion());
            this.versionedConfigAdmin = new VersionedConfigAdmin(gson.fromJson(projectModel.getConfigJson(), ConfigAdmin.class), projectModel.getVersion());
            this.categoryExpressionToWeight = this.versionedConfig.getConfig().getContent().getCategories().stream()
                    .filter(category -> category.getSupport().getExpress() != null)
                    .filter(category -> category.getSupport().getExpress().getLimitEmojiSet() != null)
                    .collect(ImmutableMap.toImmutableMap(
                            Category::getCategoryId,
                            category -> category.getSupport().getExpress().getLimitEmojiSet().stream()
                                    .collect(ImmutableMap.toImmutableMap(
                                            Expression::getDisplay,
                                            Expression::getWeight))));
            this.categories = this.versionedConfig.getConfig().getContent().getCategories().stream()
                    .collect(ImmutableMap.toImmutableMap(
                            Category::getCategoryId,
                            c -> c));

            ImmutableMap.Builder<String, IdeaStatus> statusesBuilder = ImmutableMap.builder();
            this.versionedConfig.getConfig().getContent().getCategories().forEach(category ->
                    category.getWorkflow().getStatuses().forEach(status ->
                            statusesBuilder.put(
                                    getStatusLookupKey(
                                            category.getCategoryId(),
                                            status.getStatusId()),
                                    status)));
            this.statuses = statusesBuilder.build();
            this.intercomEmailToIdentityFun = Optional.ofNullable(Strings.emptyToNull(this.versionedConfigAdmin.getConfig().getIntercomIdentityVerificationSecret()))
                    .map(intercomUtil::getEmailToIdentityFun)
                    .orElse((email) -> null);
            this.webhookEventToListeners = projectModel.getWebhookListeners() == null
                    ? ImmutableMap.of()
                    : ImmutableMap.copyOf(projectModel.getWebhookListeners().stream()
                    .map(DynamoProjectStore.this::unpackWebhookListener)
                    .flatMap(Optional::stream)
                    .collect(Collectors.groupingBy(
                            l -> webhookListenerSearchKey(l.getResourceType(), l.getEventType()),
                            Collectors.mapping(l -> l, ImmutableSet.toImmutableSet()))));
        }

        @Override
        public ProjectModel getModel() {
            return model;
        }

        @Override
        public String getAccountId() {
            return accountId;
        }

        @Override
        public String getProjectId() {
            return projectId;
        }

        @Override
        public String getVersion() {
            return version;
        }

        public VersionedConfig getVersionedConfig() {
            return versionedConfig;
        }

        public VersionedConfigAdmin getVersionedConfigAdmin() {
            return versionedConfigAdmin;
        }

        @Override
        public double getCategoryExpressionWeight(String category, String expression) {
            ImmutableMap<String, Double> expressionToWeight = categoryExpressionToWeight.get(category);
            if (expressionToWeight == null) {
                return EXPRESSION_WEIGHT_DEFAULT;
            }
            return expressionToWeight.getOrDefault(expression, EXPRESSION_WEIGHT_DEFAULT);
        }

        @Override
        public Optional<Category> getCategory(String categoryId) {
            return Optional.ofNullable(categories.get(categoryId));
        }

        @Override
        public Optional<IdeaStatus> getStatus(String categoryId, String statusId) {
            return Optional.ofNullable(this.statuses.get(getStatusLookupKey(categoryId, statusId)));
        }

        @Override
        public boolean isVotingAllowed(VoteValue voteValue, String categoryId, Optional<String> statusIdOpt) {
            Optional<Voting> votingOpt = Optional.ofNullable(getCategory(categoryId)
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find category"))
                    .getSupport()
                    .getVote());
            if (!votingOpt.isPresent()) {
                return false;
            } else if (voteValue == VoteValue.Downvote && votingOpt.get().getEnableDownvotes() != Boolean.TRUE) {
                return false;
            }

            if (statusIdOpt.isPresent()) {
                IdeaStatus status = getStatus(categoryId, statusIdOpt.get())
                        .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find status"));
                if (status.getDisableVoting() == Boolean.TRUE) {
                    return false;
                }
            }

            return true;
        }

        @Override
        public boolean isExpressingAllowed(String categoryId, Optional<String> statusIdOpt) {
            Optional<Expressing> expressOpt = Optional.ofNullable(getCategory(categoryId)
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find category"))
                    .getSupport()
                    .getExpress());
            if (!expressOpt.isPresent()) {
                return false;
            }

            if (statusIdOpt.isPresent()) {
                IdeaStatus status = getStatus(categoryId, statusIdOpt.get())
                        .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find status"));
                if (status.getDisableExpressions() == Boolean.TRUE) {
                    return false;
                }
            }

            return true;
        }

        @Override
        public boolean isFundingAllowed(String categoryId, Optional<String> statusIdOpt) {
            boolean fundAllowed = getCategory(categoryId)
                    .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find category"))
                    .getSupport()
                    .getFund();
            if (!fundAllowed) {
                return false;
            }

            if (statusIdOpt.isPresent()) {
                IdeaStatus status = getStatus(categoryId, statusIdOpt.get())
                        .orElseThrow(() -> new ApiException(Response.Status.INTERNAL_SERVER_ERROR, "Cannot find status"));
                if (status.getDisableFunding() == Boolean.TRUE) {
                    return false;
                }
            }

            return true;
        }

        @Override
        public void areTagsAllowedByUser(List<String> tagIds, String categoryId) throws ApiException {
            if (tagIds == null || tagIds.isEmpty()) {
                return;
            }
            Optional<Category> categoryOpt = getCategory(categoryId);
            if (!categoryOpt.isPresent()) {
                throw new ApiException(Response.Status.BAD_REQUEST, "Cannot find this category");
            }
            categoryOpt.stream()
                    .map(Category::getTagging)
                    .flatMap(tagging -> tagging.getTagGroups() == null
                            ? Stream.of() : tagging.getTagGroups().stream())
                    .forEach(group -> {
                        if (!group.getUserSettable()) {
                            throw new ApiException(Response.Status.BAD_REQUEST, "Tags for " + group.getName() + " are not allowed");
                        }
                        if (group.getMaxRequired() == null && group.getMinRequired() == null) {
                            return;
                        }
                        long tagsInGroupCount = tagIds.stream()
                                .filter(tagId -> group.getTagIds().contains(tagId))
                                .count();
                        if (group.getMaxRequired() != null && group.getMaxRequired() < tagsInGroupCount) {
                            throw new ApiException(Response.Status.BAD_REQUEST, "Maximum tags for " + group.getName() + " is " + group.getMaxRequired());
                        }
                        if (group.getMinRequired() != null && group.getMinRequired() > tagsInGroupCount) {
                            throw new ApiException(Response.Status.BAD_REQUEST, "Minimum tags for " + group.getName() + " is " + group.getMinRequired());
                        }
                    });

        }

        @Override
        public Function<String, String> getIntercomEmailToIdentityFun() {
            return intercomEmailToIdentityFun;
        }

        @Override
        public ImmutableSet<WebhookListener> getWebhookListenerUrls(ResourceType resourceType, String event) {
            return webhookEventToListeners.getOrDefault(webhookListenerSearchKey(resourceType, event), ImmutableSet.of());
        }

        @Override
        public String getHostnameFromSubdomain() {
            return versionedConfigAdmin.getConfig().getSlug() + "." + configApp.domain();
        }

        @Override
        public Optional<String> getHostnameFromDomain() {
            return Optional.ofNullable(Strings.emptyToNull(versionedConfigAdmin.getConfig().getDomain()));
        }

        private String webhookListenerSearchKey(ResourceType resourceType, String event) {
            return resourceType.name() + event;
        }

        @Override
        public String getHostname() {
            return Project.getHostname(versionedConfigAdmin.getConfig(), configApp);
        }

        private String getStatusLookupKey(String categoryId, String statusId) {
            return categoryId + ":" + statusId;
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ProjectStore.class).to(DynamoProjectStore.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
