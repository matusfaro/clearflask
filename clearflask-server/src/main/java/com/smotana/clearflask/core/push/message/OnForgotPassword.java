// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.core.push.message;

import com.google.common.base.Strings;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.api.model.ConfigAdmin;
import com.smotana.clearflask.core.push.provider.EmailService.Email;
import com.smotana.clearflask.store.ProjectStore;
import com.smotana.clearflask.store.UserStore;
import com.smotana.clearflask.store.UserStore.UserModel;
import com.smotana.clearflask.web.Application;
import lombok.extern.slf4j.Slf4j;

import static com.google.common.base.Preconditions.checkArgument;
import static com.smotana.clearflask.core.push.NotificationServiceImpl.AUTH_TOKEN_PARAM_NAME;

@Slf4j
@Singleton
public class OnForgotPassword {

    public interface Config {
        @DefaultValue("Forgot password")
        String subjectTemplate();

        @DefaultValue("Forgot your password? Click the link below to access your account.")
        String contentTemplate();
    }

    @Inject
    private Config config;
    @Inject
    private Application.Config configApp;
    @Inject
    private UserStore userStore;
    @Inject
    private EmailTemplates emailTemplates;

    public Email email(ConfigAdmin configAdmin, UserModel user, String link, String authToken) {
        checkArgument(!Strings.isNullOrEmpty(user.getEmail()));

        String subject = config.subjectTemplate();
        String content = config.contentTemplate();

        String templateHtml = emailTemplates.getNotificationTemplateHtml();
        String templateText = emailTemplates.getNotificationTemplateText();

        templateHtml = templateHtml.replace("__CONTENT__", content);
        templateText = templateText.replace("__CONTENT__", content);

        String buttonText = "Account settings";
        templateHtml = templateHtml.replace("__BUTTON_TEXT__", buttonText);
        templateText = templateText.replace("__BUTTON_TEXT__", buttonText);

        link += "?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replace("__BUTTON_URL__", link);
        templateText = templateText.replace("__BUTTON_URL__", link);

        String unsubscribeLink = "https://" + ProjectStore.Project.getHostname(configAdmin, configApp) + "/account?" + AUTH_TOKEN_PARAM_NAME + "=" + authToken;
        templateHtml = templateHtml.replace("__UNSUBSCRIBE_URL__", unsubscribeLink);
        templateText = templateText.replace("__UNSUBSCRIBE_URL__", unsubscribeLink);

        return new Email(
                user.getEmail(),
                subject,
                templateHtml,
                templateText,
                configAdmin.getProjectId(),
                "FORGOT_PASSWORD"
        );
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(OnForgotPassword.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
