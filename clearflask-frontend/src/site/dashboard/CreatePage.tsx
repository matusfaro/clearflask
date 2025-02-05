// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
/// <reference path="../../@types/transform-media-imports.d.ts"/>
import { Button, Card, CardActionArea, CardContent, CardHeader, Collapse, Hidden, InputAdornment, SvgIconTypeMap, TextField, Typography } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, makeStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import InternalFeedbackIcon from '@material-ui/icons/AccountBoxRounded';
import BlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import OpenCommunityIcon from '@material-ui/icons/Group';
import CustomerFeedbackIcon from '@material-ui/icons/RecordVoiceOver';
import classNames from 'classnames';
import React, { Component } from 'react';
import ReactGA from 'react-ga';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import CreatedImg from '../../../public/img/dashboard/created.svg';
import FeaturesImg from '../../../public/img/landing/hero.svg';
import UpgradeImg from '../../../public/img/landing/notify.svg';
import DetailsImg from '../../../public/img/landing/understand.svg';
import * as Admin from '../../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import { HeaderLogoLogo } from '../../app/Header';
import { tourSetGuideState } from '../../common/ClearFlaskTourProvider';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater, { CreateTemplateV2Options, createTemplateV2OptionsBlank, createTemplateV2OptionsDefault, CreateTemplateV2Result } from '../../common/config/configTemplater';
import { TeammatePlanId } from '../../common/config/settings/UpgradeWrapper';
import HoverArea from '../../common/HoverArea';
import ImgIso from '../../common/ImgIso';
import SubmitButton from '../../common/SubmitButton';
import { TourDefinitionGuideState } from '../../common/tour';
import { detectEnv, Environment, isTracking } from '../../common/util/detectEnv';
import windowIso from '../../common/windowIso';
import Logo from '../Logo';

const styles = (theme: Theme) => createStyles({
  layout: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  },
  layoutHeader: {
    margin: theme.spacing(2),
    alignSelf: 'stretch',
  },
  layoutHeaderLogo: {},
  layoutContentAndImage: {
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1,
  },
  layoutContentContainer: {
    margin: theme.spacing(4, 'auto'),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  layoutContent: {},
  layoutContentTitle: {},
  layoutContentDescription: {},
  layoutContentActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    margin: theme.spacing(2),
  },
  layoutContentAction: {
    margin: theme.spacing(1),
  },
  layoutImage: {
    margin: theme.spacing(8),
    width: '100%',
    maxWidth: '30vw',
  },
  layoutLimitWidth: {
    // width: 500,
    maxWidth: 500,
  },
  templateCards: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  templateCard: {
    margin: theme.spacing(4),
    width: 200,
    display: 'flex',
    flexDirection: 'column',
  },
  projectDetailsFields: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(2, 0),
  },
  subdomainFields: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  field: {
    margin: theme.spacing(2, 1),
    width: 300,
    maxWidth: 300,
  },

  link: {
    cursor: 'pointer',
    textDecoration: 'none!important',
    color: theme.palette.text.primary,
  },
  box: {
    transition: theme.transitions.create(['border', 'opacity']),
    border: '1px solid ' + theme.palette.divider,
  },
  boxSelected: {
    borderColor: theme.palette.primary.main,
  },
  cardIcon: {
    marginTop: theme.spacing(2),
    width: '100%',
    alignSelf: 'center',
    fontSize: '4em',
    transition: theme.transitions.create(['color']),
  },
  cardIconSelected: {
    color: theme.palette.primary.main,
  },
  disabled: {
    opacity: 0.5,
  },
  extraControls: {
    display: 'flex',
    flexDirection: 'column',
    margin: theme.spacing(1),
  },
  visibilityButtonGroup: {
    margin: theme.spacing(2),
  },
  visibilityButton: {
    flexDirection: 'column',
    textTransform: 'none',
  },
  onboardOptions: {
    display: 'flex',
    flexDirection: 'column',
  },
  onboardOption: {
    margin: theme.spacing(0.5, 1),
  },
  inlineTextField: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  flexBreak: {
    width: '100%',
  },
  flexGrow: {
    flexGrow: 1,
  },
  action: {
    padding: theme.spacing(0, 2, 1),
  },
  warningIcon: {
    color: theme.palette.warning.main,
  },
});
const useStyles = makeStyles(styles);
interface Props {
  isOnboarding: boolean;
  projectCreated: (projectId: string) => void;
}
interface ConnectProps {
  isPlanTeammate?: boolean;
}
interface State extends CreateTemplateV2Options {
  step: 'upgrade-plan' | 'feature-select' | 'project-details' | 'invite';
  isSubmitting?: boolean;
  invites: Array<string>;
  createdProjectId?: string;
}
class CreatePage extends Component<Props & ConnectProps & RouteComponentProps & WithStyles<typeof styles, true>, State> {

  constructor(props) {
    super(props);

    this.state = {
      ...createTemplateV2OptionsDefault,
      step: !!this.props.isPlanTeammate ? 'upgrade-plan' : 'feature-select',
      invites: [],
    };
  }

  render() {
    switch (this.state.step) {
      case 'upgrade-plan':
        return (
          <CreateLayout
            key='upgrade-plan'
            isOnboarding={this.props.isOnboarding}
            title='Upgrade plan'
            description={(
              <>
                To create a new project on your account, we will go ahead and start your trial period now.
                <p>If you wish to create a project on another account and get accesss, contact the owner of that account.</p>
              </>
            )}
            stretchContent
            img={UpgradeImg}
            actions={[(
              <Button
                variant='contained'
                disableElevation
                color='primary'
                onClick={() => this.setState({ step: 'feature-select' })}
              >
                Got it
              </Button>
            )]}
          />
        );
      default:
      case 'feature-select':
        return (
          <CreateLayout
            key='feature-select'
            isOnboarding={this.props.isOnboarding}
            title='Choose your scenario'
            description='You can always customize later for your needs. Please pick the most suitable function for you.'
            stretchContent
            img={FeaturesImg}
            content={(
              <>
                <div className={this.props.classes.templateCards}>
                  <div className={this.props.classes.templateCards}>
                    <TemplateCard
                      className={this.props.classes.templateCard}
                      icon={CustomerFeedbackIcon}
                      title='Customer feedback'
                      content='Customer-first feedback experience for capturing unbiased feedback.'
                      onClick={() => {
                        this.setState({
                          templateFeedbackIsClassic: false,
                          templateLanding: true,
                          templateFeedback: true,
                          templateRoadmap: true,
                          templateChangelog: true,
                          isPrivate: false,
                          step: 'project-details',
                        });
                        if (isTracking()) {
                          ReactGA.event({
                            category: 'new-project',
                            action: 'choose-scenario',
                            label: 'customer-feedback',
                          });
                        }
                      }}
                    />
                    <TemplateCard
                      className={this.props.classes.templateCard}
                      icon={OpenCommunityIcon}
                      title='Open community'
                      content='Embrace community discussion around your product.'
                      onClick={() => {
                        this.setState({
                          templateFeedbackIsClassic: true,
                          templateLanding: true,
                          templateFeedback: true,
                          templateRoadmap: true,
                          templateChangelog: true,
                          isPrivate: false,
                          step: 'project-details',
                        });
                        if (isTracking()) {
                          ReactGA.event({
                            category: 'new-project',
                            action: 'choose-scenario',
                            label: 'open-community',
                          });
                        }
                      }}
                    />
                  </div>
                  <div className={this.props.classes.templateCards}>
                    <TemplateCard
                      className={this.props.classes.templateCard}
                      icon={InternalFeedbackIcon}
                      title='Internal feedback'
                      content='Feedback collected within a private group or organization.'
                      onClick={() => {
                        this.setState({
                          templateFeedbackIsClassic: true,
                          templateLanding: true,
                          templateFeedback: true,
                          templateRoadmap: true,
                          templateChangelog: true,
                          isPrivate: true,
                          step: 'project-details',
                        });
                        if (isTracking()) {
                          ReactGA.event({
                            category: 'new-project',
                            action: 'choose-scenario',
                            label: 'internal-feedback',
                          });
                        }
                      }}
                    />
                    {!this.props.isOnboarding && (
                      <TemplateCard
                        className={this.props.classes.templateCard}
                        icon={BlankIcon}
                        title='Blank project'
                        content='For advanced use-cases, start without pre-defined templates.'
                        onClick={() => {
                          this.setState({
                            ...createTemplateV2OptionsBlank,
                            isPrivate: false,
                            step: 'project-details',
                          });
                          if (isTracking()) {
                            ReactGA.event({
                              category: 'new-project',
                              action: 'choose-scenario',
                              label: 'blank',
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          />
        );
      case 'project-details':
        return (
          <CreateLayout
            key='project-details'
            isOnboarding={this.props.isOnboarding}
            title='Fill out details'
            description='Give us a few more details about your project.'
            img={DetailsImg}
            content={(
              <div className={this.props.classes.projectDetailsFields}>
                <TextField
                  className={this.props.classes.field}
                  variant='outlined'
                  autoFocus
                  label='Your website (Optional)'
                  placeholder='example.com'
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoWebsite || ''}
                  onChange={e => {
                    const nameMatch = e.target.value.match(/^(https?:\/\/)?([^./]+).*$/);
                    var slug: string | undefined = undefined;
                    var name: string | undefined = undefined;
                    if (nameMatch && nameMatch[2]) {
                      name = nameMatch[2].toLowerCase();
                      if (name) {
                        name = name.charAt(0).toUpperCase() + name.slice(1);
                        slug = this.nameToSlug(name);
                      }
                    }
                    const logoMatch = e.target.value.match(/^(https?:\/\/)?([^/]+).*$/);
                    var logo: string | undefined = undefined;
                    if (logoMatch && logoMatch[2]) {
                      logo = `${logoMatch[1] || 'https://'}${logoMatch[2]}/favicon.ico`;
                    }
                    this.setState({
                      infoWebsite: e.target.value,
                      ...(!!logo ? { infoLogo: logo } : {}),
                      ...(!!slug ? { infoSlug: slug } : {}),
                      ...(!!name ? { infoName: name } : {}),
                    })
                  }}
                />
                <TextField
                  className={this.props.classes.field}
                  variant='outlined'
                  label='Product name'
                  placeholder='Vandelay Industries'
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoName || ''}
                  onChange={e => {
                    const slug = this.nameToSlug(e.target.value);
                    this.setState({
                      infoName: e.target.value,
                      ...(!!slug ? { infoSlug: slug } : {}),
                    });
                  }}
                />
                {detectEnv() === Environment.PRODUCTION_SELF_HOST ? (
                  <TextField
                    className={this.props.classes.field}
                    variant='outlined'
                    label='Portal domain'
                    disabled={!!this.state.isSubmitting}
                    value={this.state.infoDomain !== undefined ? this.state.infoDomain : windowIso.parentDomain}
                    onChange={e => this.setState({ infoSlug: e.target.value })}
                  />
                ) : (
                  <div className={this.props.classes.subdomainFields}>
                    <TextField
                      className={this.props.classes.field}
                      variant='outlined'
                      label='Portal subdomain'
                      placeholder='vandelay-industries'
                      disabled={!!this.state.isSubmitting}
                      value={this.state.infoSlug || ''}
                      onChange={e => this.setState({ infoSlug: e.target.value })}
                    />
                    <Typography variant='h6' component='div'>{`.${windowIso.parentDomain}`}</Typography>
                  </div>
                )}
                <TextField
                  className={this.props.classes.field}
                  variant='outlined'
                  label='Logo URL (Optional)'
                  placeholder='example.com/favicon.ico'
                  disabled={!!this.state.isSubmitting}
                  value={this.state.infoLogo || ''}
                  onChange={e => this.setState({ infoLogo: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        {this.state.infoLogo && (
                          <HeaderLogoLogo logoUrl={this.state.infoLogo} />
                        )}
                      </InputAdornment>
                    ),
                  }}
                />
              </div>
            )}
            actions={[(
              <Button
                variant='text'
                onClick={() => this.setState({ step: 'feature-select' })}
              >
                Back
              </Button>
            ), (
              <SubmitButton
                variant='contained'
                disableElevation
                color='primary'
                isSubmitting={this.state.isSubmitting}
                disabled={!this.state.infoName || !this.state.infoSlug}
                onClick={() => this.onCreate()}
              >
                Create
              </SubmitButton>
            )]}
          />
        );
      case 'invite':
        var domain = 'example.com';
        if (this.state.infoWebsite) {
          try {
            const { hostname } = new URL(this.state.infoWebsite);
            domain = hostname;
          } catch (e) { }
        }
        return (
          <CreateLayout
            key='complete'
            img={CreatedImg}
            isOnboarding={this.props.isOnboarding}
            title='Success!'
            description={`You've created ${this.state.infoName || 'your project'}. Invite your teammates to explore together.`}
            content={(
              <>
                {[...Array(this.state.invites.length + (this.state.invites.length < 8 ? 1 : 0)).keys()].map(inviteIndex => (
                  <Collapse in appear>
                    <TextField
                      key={`invite-${inviteIndex}`}
                      className={this.props.classes.field}
                      variant='outlined'
                      size='small'
                      placeholder={`sandy@${domain}`}
                      disabled={!!this.state.isSubmitting}
                      value={this.state.invites[inviteIndex] || ''}
                      onChange={e => this.setState({
                        invites: Object.assign([], this.state.invites, { [inviteIndex]: e.target.value })
                      })}
                    />
                  </Collapse>
                ))}
              </>
            )}
            actions={[(
              <Button
                variant='text'
                onClick={() => this.goHome()}
              >
                skip
              </Button>
            ), (
              <SubmitButton
                variant='contained'
                disableElevation
                color='primary'
                isSubmitting={this.state.isSubmitting}
                disabled={!this.state.invites.some(invite => !!invite)}
                onClick={() => this.onInvite()}
              >
                Invite
              </SubmitButton>
            )]}
          />
        );
    }
  }

  async createConfig(): Promise<{ config: Admin.ConfigAdmin, templates: CreateTemplateV2Result }> {
    const editor = new ConfigEditor.EditorImpl();
    const templater = Templater.get(editor);
    const templates = await templater.createTemplateV2({
      ...this.state,
      ...(detectEnv() === Environment.PRODUCTION_SELF_HOST ? {
        infoDomain: this.state.infoDomain || windowIso.parentDomain,
      } : {})
    });
    const config = editor.getConfig();
    return { config, templates };
  }

  async goHome() {
    this.props.history.push('/dashboard');
  }

  async onInvite() {
    this.goHome();

    if (!this.state.createdProjectId) return;
    const d = await ServerAdmin.get().dispatchAdmin();
    for (const email of this.state.invites) {
      if (!email) continue;
      tourSetGuideState('invite-teammates', TourDefinitionGuideState.Completed);
      await d.projectAdminsInviteAdmin({
        projectId: this.state.createdProjectId,
        email,
      })
    }
  }

  async onCreate() {
    this.setState({ isSubmitting: true });
    try {
      const d = await ServerAdmin.get().dispatchAdmin();
      const configAndTemplates = await this.createConfig();
      const newProject = await d.projectCreateAdmin({
        configAdmin: configAndTemplates.config,
      });
      this.setState({
        isSubmitting: false,
        step: 'invite',
        createdProjectId: newProject.projectId,
      });
      this.props.projectCreated(newProject.projectId);
    } catch (e) {
      this.setState({ isSubmitting: false });
      return;
    }
  }

  nameToSlug(name: string): string | undefined {
    if (!name) return undefined;

    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/ +/g, '-');
  }
}
export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const connectProps: ConnectProps = {
    isPlanTeammate: state.account.account.account?.basePlanId === TeammatePlanId,
  };
  return connectProps;
}, null, null, { forwardRef: true })(withStyles(styles, { withTheme: true })(withRouter(CreatePage)));

const TemplateCard = (props: {
  icon?: OverridableComponent<SvgIconTypeMap>,
  className?: string;
  title: string;
  content: string;
  disabled?: boolean;
  onClick: () => void;
}) => {
  const classes = useStyles();
  const Icon = props.icon;
  return (
    <HoverArea>
      {(hoverAreaProps, isHovering, isHoverDisabled) => (
        <Card {...hoverAreaProps} elevation={0} className={classNames(
          props.className,
          classes.box,
          isHovering && classes.boxSelected,
          props.disabled && classes.disabled,
        )}>
          <CardActionArea
            onClick={props.onClick}
            disabled={props.disabled}
            className={classNames(classes.flexGrow)}
          >
            {!!Icon && (
              <Icon fontSize='inherit' color='inherit' className={classNames(
                classes.cardIcon,
                isHovering && classes.cardIconSelected,
              )} />
            )}
            <CardHeader
              title={props.title}
              titleTypographyProps={{ align: 'center' }}
              subheaderTypographyProps={{ align: 'center' }}
            />
            <CardContent>{props.content}</CardContent>
          </CardActionArea>
        </Card>
      )}
    </HoverArea>
  );
};

const CreateLayout = (props: {
  title: string;
  isOnboarding?: boolean;
  description: React.ReactNode;
  stretchContent?: boolean;
  content?: React.ReactNode;
  actions?: React.ReactNode[];
  img: Img;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.layout}>
      {props.isOnboarding && (
        <div className={classes.layoutHeader}>
          <div className={classes.layoutHeaderLogo}><Logo /></div>
        </div>
      )}
      <div className={classes.layoutContentAndImage}>
        <div className={classes.layoutContentContainer}>
          <div className={classes.layoutLimitWidth}>
            <Typography variant='h3' component='h1' className={classes.layoutContentTitle}>{props.title}</Typography>
            <Typography variant='h6' component='div' className={classes.layoutContentDescription}>{props.description}</Typography>
          </div>
          {!!props.content && (
            <div className={classNames(
              classes.layoutContent,
              !props.stretchContent && classes.layoutLimitWidth,
            )}>{props.content}</div>
          )}
          {!!props.actions?.length && (
            <div className={classNames(classes.layoutContentActions, classes.layoutLimitWidth)}>
              {props.actions.map(action => (
                <div className={classes.layoutContentAction}>
                  {action}
                </div>
              ))}
            </div>
          )}
        </div>
        <Hidden mdDown>
          <ImgIso
            alt=''
            className={classes.layoutImage}
            src={props.img.src}
            aspectRatio={props.img.aspectRatio}
            width={props.img.width}
            height={props.img.height}
            maxWidth={props.img.width}
            maxHeight={props.img.height}
          />
        </Hidden>
      </div>
    </div>
  );
};
