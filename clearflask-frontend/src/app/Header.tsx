import { Divider, IconButton, Link, Tab, Tabs, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import BalanceIcon from '@material-ui/icons/AccountBalance';
import AccountIcon from '@material-ui/icons/AccountCircle';
import NotificationsIcon from '@material-ui/icons/Notifications';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../api/client';
import { ReduxState, Server, Status } from '../api/server';
import { contentScrollApplyStyles, Side } from '../common/ContentScroll';
import DropdownTab from '../common/DropdownTab';
import NotificationBadge from './NotificationBadge';

const styles = (theme: Theme) => createStyles({
  indicator: {
    borderRadius: '1px',
    bottom: 'unset',
    top: 0,
    height: 1,
  },
  header: {
    width: '100%',
    maxWidth: '1024px',
    margin: '0px auto',
    padding: theme.spacing(1),
  },
  // TODO figure out how to place these AND allow scroll buttons
  // tabs: {
  // display: 'inline-flex',
  // whiteSpace: 'nowrap',
  // '&:before': {
  //   content: '\'\'',
  //   width: '100%',
  //   minWidth: '0px',
  //   maxWidth: '50px',
  //   display: 'inline-block',
  //   height: '100px',
  // },
  // '&:after': {
  //   content: '\'\'',
  //   width: '100%',
  //   minWidth: '0px',
  //   maxWidth: '50px',
  //   display: 'inline-block',
  //   height: '100px',
  // },
  // },
  tabsFlexContainer: {
    alignItems: 'center',
    ...(contentScrollApplyStyles(theme, Side.Left)),
  },
  grow: {
    flexGrow: 1,
  },
  logoAndActions: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1, 2, 0, 2),
  },
  logoImg: {
    maxHeight: '48px',
    margin: theme.spacing(1),
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(1, 2, 0, 2),
  },
});

interface Props {
  server: Server;
  pageSlug: string;
  pageChanged: (pageUrlName: string) => void;
}
interface ConnectProps {
  config?: Client.Config;
  page?: Client.Page;
  loggedInUser?: Client.UserMe;
}

class Header extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps> {
  render() {
    var menu;
    if (this.props.config && this.props.config.layout.menu.length > 0) {
      var currentTabValue = this.props.page
        ? this.props.page.slug
        : undefined;
      var tabs;
      tabs = this.props.config.layout.menu.map(menu => {
        if (!menu.pageIds || menu.pageIds.length === 0) return null;
        if (menu.pageIds.length === 1) {
          const page = this.props.config!.layout.pages.find(p => p.pageId === menu.pageIds[0]);
          if (page === undefined) return null;
          return (
            <Tab
              key={page.slug}
              value={page.slug}
              disableRipple
              label={menu.name || page.name}
            />
          );
        }
        const dropdownItems = menu.pageIds.map(pageId => {
          const page = this.props.config!.layout.pages.find(p => p.pageId === pageId)!;
          if (this.props.page && this.props.page.pageId === page.pageId) {
            currentTabValue = menu.menuId;
          }
          return { name: page.name, val: page.slug };
        });
        return (
          <DropdownTab
            key={menu.menuId}
            value={menu.menuId}
            selectedValue={this.props.page && this.props.page.slug}
            label={menu.name}
            links={dropdownItems}
            onDropdownTabSelect={value => this.props.pageChanged(value)}
          />
        );
      });
      menu = (
        <Tabs
          centered
          variant='standard'
          scrollButtons='off'
          classes={{
            flexContainer: this.props.classes.tabsFlexContainer,
            indicator: this.props.classes.indicator,
          }}
          value={currentTabValue}
          onChange={(event, value) => this.props.pageChanged(value)}
          indicatorColor="primary"
          textColor="primary"
        >
          {tabs}
        </Tabs>
      );
    }

    var name: any = this.props.config?.name && (
      <Typography variant='h6'>
        {this.props.config && this.props.config.name}
      </Typography>
    );
    if (this.props.config && this.props.config.website) {
      name = (
        <Link color='inherit' href={this.props.config.website} underline='none' rel='noopener nofollow'>
          {name}
        </Link>
      );
    }
    var logo = this.props.config && (this.props.config.logoUrl || this.props.config.name) ? (
      <div className={this.props.classes.logo}>
        {this.props.config.logoUrl && (
          <img alt='logo' src={this.props.config.logoUrl} className={this.props.classes.logoImg} />
        )}
        {name}
      </div>
    ) : undefined;

    var rightSide = this.props.config && this.props.loggedInUser && (
      <div className={this.props.classes.actions}>
        <IconButton
          aria-label='Notifications'
          onClick={() => this.props.history.push(`/${this.props.server.getProjectId()}/notification`)}
        >
          <NotificationBadge server={this.props.server}>
            <NotificationsIcon fontSize='small' />
          </NotificationBadge>
        </IconButton>
        <IconButton
          aria-label='Balance'
          onClick={() => this.props.history.push(`/${this.props.server.getProjectId()}/transaction`)}
        >
          <BalanceIcon fontSize='small' />
        </IconButton>
        <IconButton
          aria-label='Account'
          onClick={() => this.props.history.push(`/${this.props.server.getProjectId()}/account`)}
        >
          <AccountIcon fontSize='small' />
        </IconButton>
      </div>
    );

    return (
      <div className={this.props.classes.header}>
        <div className={this.props.classes.logoAndActions}>
          {logo}
          <div className={this.props.classes.grow} />
          {rightSide}
        </div>
        <Divider />
        {menu}
      </div>
    );
  }

  menuSelected(menuId: string) {

  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var page: Client.Page | undefined = undefined;
  if (state.conf.status === Status.FULFILLED && state.conf.conf) {
    page = state.conf.conf.layout.pages.find(p => p.slug === ownProps.pageSlug);
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    page: page,
    loggedInUser: state.users.loggedIn.user,
  };
})(withStyles(styles, { withTheme: true })(withRouter(Header)));
