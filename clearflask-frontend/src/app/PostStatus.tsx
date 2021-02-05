import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import OpenIcon from '@material-ui/icons/OpenInNew';
import QueryString from 'query-string';
import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router';
import * as Client from '../api/client';
import { Server } from '../api/server';
import WebNotification from '../common/notification/webNotification';
import Promised from '../common/Promised';
import { detectEnv, Environment } from '../common/util/detectEnv';
import windowIso from '../common/windowIso';

export class PostStatusConfigDef {
  fontSize?: number | string;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  fontWeight?: number;
  alignItems?: string;
  justifyContent?: string;
  textTransform?: string;
}
export interface PostStatusConfig extends PostStatusConfigDef { };

const styles = (theme: Theme) => createStyles({
  linkContainer: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  link: {
    color: 'inherit',
    outline: 0,
    textDecoration: 'inherit',
    display: 'flex',
    alignItems: 'center',
  },
});
interface Props {
  postId: string;
}
interface State {
}
class PostStatus extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  dataPromise: Promise<[Client.VersionedConfig, Client.UserMeWithBalance | undefined, Client.IdeaWithVote]>;

  constructor(props) {
    super(props);

    this.dataPromise = this.fetchData(props);
  }

  async fetchData(props: Props): Promise<[Client.VersionedConfig, Client.UserMeWithBalance | undefined, Client.IdeaWithVote]> {
    var server: Server | undefined;
    if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      const DemoApp = await import(/* webpackChunkName: "demoApp" */'../site/DemoApp');
      const project = await DemoApp.getProject(
        templater => templater.workflowFeatures(templater.demoCategory()),
        mock => mock.mockFakeIdeaWithComments(props.postId, config => ({
          statusId: config.content.categories[0]?.workflow.statuses[3]?.statusId,
        })),
        { suppressSetTitle: true });
      server = project.server;
    } else {
      server = new Server();
    }

    const configAndUserBindPromise = WebNotification.getInstance().getPermission().then(subscriptionResult => server!.dispatch().then(d => d.configGetAndUserBind({
      slug: windowIso.location.hostname,
      userBind: {
        browserPushToken: (subscriptionResult !== undefined && subscriptionResult.type === 'success')
          ? subscriptionResult.token : undefined,
      },
    })));

    const postPromise = (await server.dispatch()).ideaGet({
      projectId: server.getProjectId(),
      ideaId: props.postId,
    });

    const [configAndUserBind, post] = await Promise.all([configAndUserBindPromise, postPromise]);

    if (!configAndUserBind.config) {
      throw new Error('Permission denied');
    }

    return [configAndUserBind.config, configAndUserBind.user, post];
  }

  render() {
    const queryParams = QueryString.parse(this.props.location.search);
    const statusConfig = queryParams as PostStatusConfig;

    return (
      <Promised
        promise={this.dataPromise}
        render={([config, user, post]) => {

          var status = config.config
            .content
            .categories
            .find(c => c.categoryId === post.categoryId)
            ?.workflow
            .statuses
            .find(s => s.statusId === post.statusId);
          if (!status && detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
            status = {
              name: 'Planned',
              nextStatusIds: [],
              color: '#3B67AE',
              statusId: 'a',
              disableFunding: false,
              disableExpressions: false,
              disableVoting: false,
              disableComments: false,
              disableIdeaEdits: true
            };
          }
          if (!status) {
            console.log('Failed to load, post has no status', config, user, post);
            return null;
          };

          const src = `${windowIso.location.origin}/post/${post.ideaId}`;

          return (
            <div
              className={this.props.classes.linkContainer}
              style={{
                color: statusConfig.color || status.color,
                fontSize: statusConfig.fontSize,
                fontFamily: statusConfig.fontFamily,
                backgroundColor: statusConfig.backgroundColor,
                fontWeight: statusConfig.fontWeight,
                alignItems: statusConfig.alignItems,
                justifyContent: statusConfig.justifyContent,
                textTransform: statusConfig.textTransform as any,
              }}
            >
              <a // eslint-disable-line react/jsx-no-target-blank
                href={src}
                target='_blank'
                rel='noopener nofollow'
                className={this.props.classes.link}
              >
                {status.name}
                &nbsp;
                <OpenIcon fontSize='inherit' />
              </a>
            </div>
          );
        }}
        renderError={err => {
          console.log('Failed to load:', err);
          return null;
        }}
        renderLoading={() => null}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostStatus);
