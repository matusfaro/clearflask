import * as ConfigEditor from "./configEditor";
import * as Admin from "../../api/admin";
import randomUuid from "../util/uuid";
import stringToSlug from "../util/slugger";

export default class Templater {
  editor:ConfigEditor.Editor;

  constructor(editor:ConfigEditor.Editor) {
    this.editor = editor;
  }

  static get(editor:ConfigEditor.Editor):Templater {
    return new Templater(editor);
  }

  demo() {
    this._get<ConfigEditor.StringProperty>(['name']).set('Demo App');
    this.creditsCurrency();
    // TODO Home
    // TODO FAQ
    this.baseFeatures();
    // TODO KNOWLEDGE BASE
    // TODO BLOG
    // TODO BUG BOUNTY
    // TODO QUESTION AND ANSWER
    // TODO FORUM
  }
  
  demoPrioritization() {
    const categoryIndex = this.demoCategory();

    this.supportFunding(categoryIndex);
    this.creditsCurrency();

    this.demoPagePanel(Admin.PostDisplayToJSON({
      titleTruncateLines: 2,
      descriptionTruncateLines: 3,
      showDescription: true,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: true,
      showFunding: true,
      showExpression: true,
      disableExpand: true,
    }));
  }

  demoCategory() {
    const categoryId = randomUuid();
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: categoryId, name: 'Idea', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: true}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const categoryIndex = categories.getChildPages().length - 1;
    return categoryIndex;
  }

  demoPagePanel(display:Admin.PostDisplay = {}) {
    const pageId = randomUuid();
    this._get<ConfigEditor.PageGroup>(['layout', 'pages']).insert().setRaw(Admin.PageToJSON({
      pageId: pageId,
      name: 'Demo',
      slug: stringToSlug('demo'),
      panels: [
        Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON(display), search: Admin.IdeaSearchToJSON({})}),
      ],
    }));
  }

  baseFeatures() {
    // Enable display name
    this._get<ConfigEditor.EnumProperty>(['users', 'onboarding', 'accountFields', 'displayName']).set(Admin.AccountFieldsDisplayNameEnum.None);

    // Style
    this._get<ConfigEditor.EnumProperty>(['style', 'palette', 'expressionColor']).set(Admin.PaletteExpressionColorEnum.Washed);

    // Categories
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    // Idea
    const ideaCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: ideaCategoryId, name: 'Idea', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: true}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const ideaCategoryIndex = categories.getChildPages().length - 1;
    this.supportFunding(ideaCategoryIndex);
    this.supportVoting(ideaCategoryIndex, true);
    this.supportExpressingFacebookStyle(ideaCategoryIndex);
    this.taggingOsPlatform(ideaCategoryIndex);
    const statuses = this.workflowFeatures(ideaCategoryIndex);

    // tags: Feature Requests, Bug Reports, Translations
    // TODO redo to: Frontend, Mobile App, Public API, Bugs, Security
    const tagGroupIdIdeas = randomUuid();
    const tags = [Admin.TagToJSON({tagId: randomUuid(), name: 'Feature'}),
      Admin.TagToJSON({tagId: randomUuid(), name: 'Bug'}),
      Admin.TagToJSON({tagId: randomUuid(), name: 'Translation'})];
    this.tagging(ideaCategoryIndex, tags, Admin.TagGroupToJSON({
      tagGroupId: tagGroupIdIdeas, name: 'Ideas', userSettable: true, tagIds: [],
      minRequired: 1, maxRequired: 1,
    }));

    // Layout
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    // Home
    const pageHomeId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageHomeId,
      name: 'Home',
      slug: '',
      description: undefined,
      panels: [
        Admin.PagePanelWithSearchToJSON({title: 'Funding', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
          sortBy: Admin.IdeaSearchSortByEnum.New,
          filterCategoryIds: [ideaCategoryId],
          filterStatusIds: statuses.filter(s => s.name.match(/Funding/)).map(s => s.statusId),
        })}),
      ],
      board: Admin.PageBoardToJSON({
        title: 'Roadmap',
        panels: [
          Admin.PagePanelToJSON({title: 'Planned', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId],
            filterStatusIds: statuses.filter(s => s.name.match(/Planned/)).map(s => s.statusId),
          })}),
          Admin.PagePanelToJSON({title: 'In progress', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId],
            filterStatusIds: statuses.filter(s => s.name.match(/In progress/)).map(s => s.statusId),
          })}),
          Admin.PagePanelToJSON({title: 'Completed', display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId],
            filterStatusIds: statuses.filter(s => s.name.match(/Completed/)).map(s => s.statusId),
          })}),
        ],
        controls: Admin.PagePanelSearchToJSON({
          enableSearchByCategory: false,
          enableSearchByStatus: false,
          enableSearchByTag: false,
        }),
      }),
      explorer: undefined,
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageHomeId],
    }));
    // Features
    const pageIdeaIds:string[] = [];
    tags.forEach(tag => {
      const pageIdeaId = randomUuid();
      pageIdeaIds.push(pageIdeaId);
      pagesProp.insert().setRaw(Admin.PageToJSON({
        pageId: pageIdeaId,
        name: tag.name,
        slug: stringToSlug(tag.name),
        title: tag.name,
        description: undefined,
        panels: [],
        board: undefined,
        explorer: Admin.PageExplorerToJSON({
          allowSearch: true,
          allowCreate: true,
          panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
            filterCategoryIds: [ideaCategoryId],
            filterTagIds: [tag.tagId],
          })}),
        }),
      }));
    });
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: pageIdeaIds, name: 'Ideas',
    }));
    // Blog
    this.templateBlog();
    // Explorer
    const pageExplorerId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageExplorerId,
      name: 'Search',
      slug: stringToSlug('Explorer'),
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: true,
        allowCreate: true,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({})}),
      }),
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageExplorerId],
    }));
  }

  templateBase() {
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const pageHomeId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageHomeId,
      name: 'Home',
      slug: '',
      description: undefined,
      panels: [],
    }));

    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageHomeId],
    }));
  }

  templateFeedback(withFunding:boolean, withStandaloneFunding:boolean = true) {
    // Ideas
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const ideaCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: ideaCategoryId, name: 'Idea', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: true}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const ideaCategoryIndex = categories.getChildPages().length - 1;
    const ideaStatuses = this.workflowFeatures(ideaCategoryIndex, withStandaloneFunding);

    // Bugs
    const bugCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: bugCategoryId, name: 'Bug', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: true,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: true}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const bugCategoryIndex = categories.getChildPages().length - 1;
    const bugStatuses = this.workflowBug(bugCategoryIndex);
    this.taggingOsPlatform(bugCategoryIndex);

    // Pages
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const ideaPageId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: ideaPageId,
      name: 'Ideas',
      slug: 'ideas',
      title: undefined,
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: true,
        allowCreate: true,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [ideaCategoryId],
        })}),
      }),
    }));
    const bugPageId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: bugPageId,
      name: 'Bugs',
      slug: 'bugs',
      title: undefined,
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: true,
        allowCreate: true,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({}), search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [bugCategoryId],
        })}),
      }),
    }));

    // Menu
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [ideaPageId, bugPageId], name: 'Feedback',
    }));

    // Add to home page
    const postDisplay:Admin.PostDisplay = {
      titleTruncateLines: 2,
      descriptionTruncateLines: 4,
      showDescription: false,
      showResponse: false,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: false,
      showFunding: false,
      showExpression: false,
      disableExpand: false,
    };
    const homePagePanels = this._get<ConfigEditor.PageGroup>(['layout', 'pages', 0, 'panels']);
    homePagePanels.insert().setRaw(Admin.PagePanelWithSearchToJSON({title: 'Trending feedback', display: Admin.PostDisplayToJSON({
      ...postDisplay,
      showDescription: true,
      showFunding: true,
      showExpression: true,
      showVoting: true,
    }), search: Admin.IdeaSearchToJSON({
      sortBy: Admin.IdeaSearchSortByEnum.Trending,
      filterCategoryIds: [ideaCategoryId],
    })}));
    homePagePanels.insert().setRaw(Admin.PagePanelWithSearchToJSON({title: 'Recent Bugs', display: Admin.PostDisplayToJSON({
      ...postDisplay,
      showDescription: true,
      showResponse: true,
      showFunding: true,
      showExpression: true,
      showVoting: true,
    }), search: Admin.IdeaSearchToJSON({
      sortBy: Admin.IdeaSearchSortByEnum.New,
      filterCategoryIds: [bugCategoryId],
    })}));
    this._get<ConfigEditor.Page>(['layout', 'pages', 0, 'board'])
      .setRaw(Admin.PageBoardToJSON({
        title: 'Roadmap',
        panels: [
          ...(withFunding && withStandaloneFunding ? [
            Admin.PagePanelToJSON({title: 'Funding', display: Admin.PostDisplayToJSON({
              ...postDisplay,
              showFunding: true,
            }), search: Admin.IdeaSearchToJSON({
              sortBy: Admin.IdeaSearchSortByEnum.New,
              filterCategoryIds: [ideaCategoryId],
              filterStatusIds: ideaStatuses.filter(s => s.name.match(/Funding/)).map(s => s.statusId),
            })}),
          ] : []),
          Admin.PagePanelToJSON({title: 'Planned', display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId, bugCategoryId],
            filterStatusIds: ideaStatuses.filter(s => s.name.match(/Planned/)).map(s => s.statusId),
          })}),
          Admin.PagePanelToJSON({title: 'In progress', display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId, bugCategoryId],
            filterStatusIds: [
              ...ideaStatuses.filter(s => s.name.match(/In progress/)).map(s => s.statusId),
              ...bugStatuses.filter(s => s.name.match(/In progress/)).map(s => s.statusId),
            ],
          })}),
          Admin.PagePanelToJSON({title: 'Completed', display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
            sortBy: Admin.IdeaSearchSortByEnum.New,
            filterCategoryIds: [ideaCategoryId, bugCategoryId],
            filterStatusIds: [
              ...ideaStatuses.filter(s => s.name.match(/Completed/)).map(s => s.statusId),
              ...bugStatuses.filter(s => s.name.match(/Fixed/)).map(s => s.statusId),
            ],
          })}),
        ],
        controls: Admin.PagePanelSearchToJSON({
          enableSearchByCategory: false,
          enableSearchByStatus: false,
          enableSearchByTag: false,
        }),
      }));
  }

  templateBlog() {
    // Category
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const articleCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: articleCategoryId, name: 'Article', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: false}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const articleCategoryIndex = categories.getChildPages().length - 1;
    this.supportExpressingAllEmojis(articleCategoryIndex);

    // Home page panel
    this._get<ConfigEditor.PageGroup>(['layout', 'pages', 0, 'panels'])
      .insert().setRaw(Admin.PagePanelWithSearchToJSON({
        title: 'Blog', hideIfEmpty: true, display: Admin.PostDisplayToJSON({
          titleTruncateLines: 2,
          descriptionTruncateLines: 2,
          showDescription: true,
          showResponse: false,
          showCommentCount: false,
          showCategoryName: false,
          showCreated: false,
          showAuthor: false,
          showStatus: false,
          showTags: false,
          showVoting: false,
          showFunding: false,
          showExpression: false,
          disableExpand: false,
        }), search: Admin.IdeaSearchToJSON({
          sortBy: Admin.IdeaSearchSortByEnum.New,
          filterCategoryIds: [articleCategoryId],
        })}));

    // Pages and menu
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    const pageBlogId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: pageBlogId,
      name: 'Blog',
      slug: stringToSlug('blog'),
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: false,
        allowCreate: false,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({
          titleTruncateLines: 0,
          descriptionTruncateLines: 2,
          showDescription: true,
        }), search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [articleCategoryId],
        })}),
      }),
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [pageBlogId],
    }));
  }

  templateChangelog() {
    // Category
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const changelogCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: changelogCategoryId, name: 'Changelog', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: false}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const changelogCategoryIndex = categories.getChildPages().length - 1;
    this.supportExpressingAllEmojis(changelogCategoryIndex);

    // Home page panel
    this._get<ConfigEditor.PageGroup>(['layout', 'pages', 0, 'panels'])
      .insert().setRaw(Admin.PagePanelWithSearchToJSON({
        title: 'Recent changes', hideIfEmpty: true, display: Admin.PostDisplayToJSON({
          titleTruncateLines: 2,
          descriptionTruncateLines: 2,
          showDescription: true,
          showResponse: false,
          showCommentCount: false,
          showCategoryName: false,
          showCreated: false,
          showAuthor: false,
          showStatus: false,
          showTags: false,
          showVoting: false,
          showFunding: false,
          showExpression: false,
          disableExpand: false,
        }), search: Admin.IdeaSearchToJSON({
          sortBy: Admin.IdeaSearchSortByEnum.New,
          filterCategoryIds: [changelogCategoryId],
        })}));

    // Pages and menu
    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    const changelogPageId = randomUuid();
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: changelogPageId,
      name: 'Changelog',
      slug: stringToSlug('changelog'),
      description: undefined,
      panels: [],
      board: undefined,
      explorer: Admin.PageExplorerToJSON({
        allowSearch: false,
        allowCreate: false,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON({
          titleTruncateLines: 0,
          descriptionTruncateLines: 2,
          showDescription: true,
        }), search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [changelogCategoryId],
        })}),
      }),
    }));
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [changelogPageId],
    }));
  }

  templateKnowledgeBase() {
    // help articles
    const categories = this._get<ConfigEditor.PageGroup>(['content', 'categories']);
    const helpCategoryId = randomUuid();
    categories.insert().setRaw(Admin.CategoryToJSON({
      categoryId: helpCategoryId, name: 'Help', visibility: Admin.CategoryVisibilityEnum.PublicOrPrivate,
      userCreatable: false,
      workflow: Admin.WorkflowToJSON({statuses: []}),
      support: Admin.SupportToJSON({comment: false}),
      tagging: Admin.TaggingToJSON({tags: [], tagGroups: []}),
    }));
    const helpCategoryIndex = categories.getChildPages().length - 1;
    const accountSetupTagId = randomUuid();
    const productShippingTagId = randomUuid();
    this.tagging(helpCategoryIndex,
      [Admin.TagToJSON({tagId: accountSetupTagId, name: 'Account Setup'}),
        Admin.TagToJSON({tagId: productShippingTagId, name: 'Product Shipping'}),
      ],
      Admin.TagGroupToJSON({
        tagGroupId: randomUuid(), name: 'Categories', userSettable: false, tagIds: [],
      }));
      this.supportExpressingRange(helpCategoryIndex);

    const pagesProp = this._get<ConfigEditor.PageGroup>(['layout', 'pages']);
    const helpPageId = randomUuid();
    const postDisplay:Admin.PostDisplay = {
      titleTruncateLines: 0,
      descriptionTruncateLines: 4,
      showDescription: false,
      showResponse: false,
      showCommentCount: false,
      showCategoryName: false,
      showCreated: false,
      showAuthor: false,
      showStatus: false,
      showTags: false,
      showVoting: false,
      showFunding: false,
      showExpression: false,
      disableExpand: false,
    };
    pagesProp.insert().setRaw(Admin.PageToJSON({
      pageId: helpPageId,
      name: 'Help',
      slug: 'help',
      title: 'How can we help you?',
      description: "If you can't find help, don't hesitate to contact us at support@example.com",
      panels: [Admin.PagePanelWithSearchToJSON({title: 'Account Setup', display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
        sortBy: Admin.IdeaSearchSortByEnum.Top,
        filterCategoryIds: [helpCategoryId],
        filterTagIds: [accountSetupTagId],
      })}), Admin.PagePanelWithSearchToJSON({title: 'Product Shipping', display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
        sortBy: Admin.IdeaSearchSortByEnum.Top,
        filterCategoryIds: [helpCategoryId],
        filterTagIds: [productShippingTagId],
      })})],
      explorer: Admin.PageExplorerToJSON({
        allowSearch: true,
        allowCreate: false,
        panel: Admin.PagePanelWithSearchToJSON({display: Admin.PostDisplayToJSON(postDisplay), search: Admin.IdeaSearchToJSON({
          filterCategoryIds: [helpCategoryId],
        })}),
      }),
    }));

    const menuProp = this._get<ConfigEditor.ArrayProperty>(['layout', 'menu']);
    (menuProp.insert() as ConfigEditor.ObjectProperty).setRaw(Admin.MenuToJSON({
      menuId: randomUuid(), pageIds: [helpPageId],
    }));
  }

  supportNone(categoryIndex:number) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'fund']).set(undefined);
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'vote']).set(undefined);
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']).set(undefined);
  }
  supportFunding(categoryIndex:number) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'fund']).setRaw(Admin.FundingToJSON({
      showFunds: true, showFunders: true,
    }));
  }
  supportVoting(categoryIndex:number, enableDownvotes:boolean = false) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'vote']).setRaw(Admin.VotingToJSON({
      enableDownvotes: enableDownvotes, showVotes: true, showVoters: true,
    }));
  }
  supportExpressingAllEmojis(categoryIndex:number, limitEmojiPerIdea?:boolean) {
    this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']).set(true);
    if(limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
  }
  supportExpressingFacebookStyle(categoryIndex:number, limitEmojiPerIdea?:boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if(expressProp.value !== true) expressProp.set(true);
    if(limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({display: '👍', text: 'Thumbs up', weight: 1}),
      Admin.ExpressionToJSON({display: '❤️', text: 'Heart', weight: 1}),
      Admin.ExpressionToJSON({display: '😆', text: 'Laugh', weight: 1}),
      Admin.ExpressionToJSON({display: '😮', text: 'Shocked', weight: 0}),
      Admin.ExpressionToJSON({display: '😥', text: 'Crying', weight: -1}),
      Admin.ExpressionToJSON({display: '😠', text: 'Angry', weight: -1}),
    ]);
  }
  supportExpressingMessengerStyle(categoryIndex:number, limitEmojiPerIdea?:boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if(expressProp.value !== true) expressProp.set(true);
    if(limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({display: '😍', text: 'Love', weight: 1}),
      Admin.ExpressionToJSON({display: '😆', text: 'Laugh', weight: 1}),
      Admin.ExpressionToJSON({display: '😮', text: 'Shocked', weight: 0}),
      Admin.ExpressionToJSON({display: '😥', text: 'Crying', weight: -1}),
      Admin.ExpressionToJSON({display: '😠', text: 'Angry', weight: -1}),
      Admin.ExpressionToJSON({display: '👍', text: 'Thumbs up', weight: 1}),
      Admin.ExpressionToJSON({display: '👎', text: 'Thumbs down', weight: -1}),
    ]);
  }
  supportExpressingGithubStyle(categoryIndex:number, limitEmojiPerIdea?:boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if(expressProp.value !== true) expressProp.set(true);
    if(limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({display: '👍', text: '+1', weight: 1}),
      Admin.ExpressionToJSON({display: '👎', text: '-1', weight: -1}),
      Admin.ExpressionToJSON({display: '😆', text: 'Laugh', weight: 1}),
      Admin.ExpressionToJSON({display: '🎉', text: 'Hooray', weight: 1}),
      Admin.ExpressionToJSON({display: '😕', text: 'Confused', weight: -1}),
      Admin.ExpressionToJSON({display: '❤️', text: 'Heart', weight: 1}),
      Admin.ExpressionToJSON({display: '🚀', text: 'Rocket', weight: 1}),
      Admin.ExpressionToJSON({display: '👀', text: 'Eyes', weight: 1}),
    ]);
  }
  supportExpressingRange(categoryIndex:number) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if(expressProp.value !== true) expressProp.set(true);
    this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
    this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiSet']).setRaw([
      Admin.ExpressionToJSON({display: '😃', text: 'Smiley', weight: 1}),
      Admin.ExpressionToJSON({display: '😐', text: 'Neutral', weight: -1}),
      Admin.ExpressionToJSON({display: '😞', text: 'Disappointed', weight: -2}),
    ]);
  }
  supportExpressingLimitEmojiPerIdea(categoryIndex:number, limitEmojiPerIdea?:boolean) {
    const expressProp = this._get<ConfigEditor.ObjectProperty>(['content', 'categories', categoryIndex, 'support', 'express']);
    if(expressProp.value !== true) expressProp.set(true);
    if(limitEmojiPerIdea) this._get<ConfigEditor.BooleanProperty>(['content', 'categories', categoryIndex, 'support', 'express', 'limitEmojiPerIdea']).set(true);
  }

  taggingOsPlatform(categoryIndex:number) {
    this.tagging(categoryIndex,
      [Admin.TagToJSON({tagId: randomUuid(), name: 'Windows'}),
        Admin.TagToJSON({tagId: randomUuid(), name: 'Mac'}),
        Admin.TagToJSON({tagId: randomUuid(), name: 'Linux'})],
      Admin.TagGroupToJSON({
        tagGroupId: randomUuid(), name: 'Platform', userSettable: true, tagIds: [],
      }));
  }
  tagging(categoryIndex:number, tags:Admin.Tag[], tagGroup:Admin.TagGroup) {
    const tagsProp = this._get<ConfigEditor.ArrayProperty>(['content', 'categories', categoryIndex, 'tagging', 'tags']);
    tags.forEach(tag => (tagsProp.insert() as ConfigEditor.ObjectProperty).setRaw(tag))
    this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'tagging', 'tagGroups']).insert().setRaw(Admin.TagGroupToJSON({
      ...tagGroup, tagIds: tags.map(tag => tag.tagId),
    }));
  }

  workflowFeatures(categoryIndex:number, withStandaloneFunding:boolean = true):Admin.IdeaStatus[] {
    const closed = Admin.IdeaStatusToJSON({name: 'Closed', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:false});
    const completed = Admin.IdeaStatusToJSON({name: 'Completed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding:true, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:true});
    const inProgress = Admin.IdeaStatusToJSON({name: 'In progress', nextStatusIds: [closed.statusId, completed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding:true, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:true});
    const planned = Admin.IdeaStatusToJSON({name: 'Planned', nextStatusIds: [closed.statusId, inProgress.statusId], color: 'blue', statusId: randomUuid(), disableFunding:withStandaloneFunding, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:true});
    var funding;
    if(withStandaloneFunding) {
      funding = Admin.IdeaStatusToJSON({name: 'Funding', nextStatusIds: [closed.statusId, planned.statusId], color: 'green', statusId: randomUuid(), disableFunding:false, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:true});
    }
    const underReview = Admin.IdeaStatusToJSON({name: 'Under review', nextStatusIds: [...(withStandaloneFunding ? [funding.statusId] : []), closed.statusId, planned.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding:withStandaloneFunding, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:false});
    return this.workflow(categoryIndex, underReview.statusId, [closed, completed, inProgress, planned, underReview, ...(withStandaloneFunding ? [funding] : [])]);
  }
  workflowBug(categoryIndex:number):Admin.IdeaStatus[] {
    const notReproducible = Admin.IdeaStatusToJSON({name: 'Not reproducible', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:false});
    const wontFix = Admin.IdeaStatusToJSON({name: 'Won\'t fix', nextStatusIds: [], color: 'darkred', statusId: randomUuid(), disableFunding:true, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:false});
    const fixed = Admin.IdeaStatusToJSON({name: 'Fixed', nextStatusIds: [], color: 'darkgreen', statusId: randomUuid(), disableFunding:true, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:true});
    const inProgress = Admin.IdeaStatusToJSON({name: 'In progress', nextStatusIds: [wontFix.statusId, notReproducible.statusId, fixed.statusId], color: 'darkblue', statusId: randomUuid(), disableFunding:true, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:true});
    const underReview = Admin.IdeaStatusToJSON({name: 'Under review', nextStatusIds: [inProgress.statusId, wontFix.statusId, notReproducible.statusId], color: 'lightblue', statusId: randomUuid(), disableFunding:false, disableExpressions:false, disableVoting:false, disableComments:false, disableIdeaEdits:false});
    return this.workflow(categoryIndex, underReview.statusId, [notReproducible, wontFix, fixed, inProgress, underReview]);
  }
  workflow(categoryIndex:number, entryStatusId:string, statuses:Admin.IdeaStatus[]):Admin.IdeaStatus[] {
    this._get<ConfigEditor.LinkProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus']).set(undefined);
    this._get<ConfigEditor.PageGroup>(['content', 'categories', categoryIndex, 'workflow', 'statuses']).setRaw(statuses);
    this._get<ConfigEditor.LinkProperty>(['content', 'categories', categoryIndex, 'workflow', 'entryStatus']).set(entryStatusId);
    return statuses;
  }

  creditsCurrency() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({prefix: '$', multiplier: 0.01, greaterOrEqual: 10000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({prefix: '$', multiplier: 0.01, greaterOrEqual: 100, minimumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({prefix: '$', lessOrEqual: 0}),
      Admin.CreditFormatterEntryToJSON({prefix: '¢'}),
    ]);
  }
  creditsTime() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: ' Weeks', multiplier: 0.025, greaterOrEqual: 41, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Week', multiplier: 0.025, greaterOrEqual: 40, lessOrEqual: 40}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Days', multiplier: 0.125, greaterOrEqual: 9, lessOrEqual: 39, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Day', multiplier: 0.125, greaterOrEqual: 8, lessOrEqual: 8}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hrs', greaterOrEqual: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' Hr', lessOrEqual: 1}),
    ]);
  }
  creditsUnitless() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2}),
    ]);
  }
   /**
    * TODO Create scale instead of credits. Possibly negative credits too?
    * Requirements:
    * - Display # of people funded and average instead of total
    * - Max funding per item
    * - Balance and transaction history??
    * - Goal??
    */
  // creditsScale() {
  //   this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(0.01);
  //   this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
  //     Admin.CreditFormatterEntryToJSON({suffix: 'Critical', multiplier: 100, greaterOrEqual: 0.9}),
  //     Admin.CreditFormatterEntryToJSON({suffix: 'High', multiplier: 100, greaterOrEqual: 10000000}),
  //     Admin.CreditFormatterEntryToJSON({suffix: 'Medium', multiplier: 100, greaterOrEqual: 0.2}),
  //     Admin.CreditFormatterEntryToJSON({suffix: 'Low', multiplier: 100, lessOrEqual: 0.1}),
  //   ]);
  // }
  creditsBeer() {
    this._get<ConfigEditor.NumberProperty>(['credits', 'increment']).set(1);
    this._get<ConfigEditor.ArrayProperty>(['credits', 'formats']).setRaw([
      Admin.CreditFormatterEntryToJSON({suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 100000000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 10000000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'm 🍺', multiplier: 0.000001, greaterOrEqual: 1000000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 100000, maximumFractionDigits: 0}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 10000, maximumFractionDigits: 1}),
      Admin.CreditFormatterEntryToJSON({suffix: 'k 🍺', multiplier: 0.001, greaterOrEqual: 1000, maximumFractionDigits: 2}),
      Admin.CreditFormatterEntryToJSON({suffix: ' 🍺', lessOrEqual: 999}),
    ]);
  }

  usersOnboardingEmail(enable:boolean, passwordRequirement:Admin.EmailSignupPasswordEnum = Admin.EmailSignupPasswordEnum.Optional, confirmEmails:boolean = false) {
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'email']).set(enable ? true : undefined);
    if(enable) {
      this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'notificationMethods', 'email', 'password']).set(passwordRequirement);
      this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'email', 'confirmEmails']).set(confirmEmails);
    }
  }

  usersOnboardingAnonymous(enable:boolean, onlyShowIfPushNotAvailable:boolean = false) {
    this._get<ConfigEditor.ObjectProperty>(['users', 'onboarding', 'notificationMethods', 'anonymous']).set(enable ? true : undefined);
    if(enable) {
      this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'anonymous', 'onlyShowIfPushNotAvailable']).set(onlyShowIfPushNotAvailable);
    }
  }

  usersOnboardingMobilePush(enable:boolean) {
    this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'mobilePush']).set(enable);
  }

  usersOnboardingBrowserPush(enable:boolean) {
    this._get<ConfigEditor.BooleanProperty>(['users', 'onboarding', 'notificationMethods', 'browserPush']).set(enable);
  }

  usersOnboardingDisplayName(requirement:Admin.AccountFieldsDisplayNameEnum) {
    this._get<ConfigEditor.StringProperty>(['users', 'onboarding', 'accountFields', 'displayName']).set(requirement);
  }

  _get<T extends ConfigEditor.Setting<any, any>>(path:ConfigEditor.Path):T {
    return this.editor.get(path) as any as T;
  }
}
