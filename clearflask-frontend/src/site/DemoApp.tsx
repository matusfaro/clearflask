import React, { Component } from 'react';
import Admin from './Admin';
import * as ConfigEditor from '../common/config/configEditor';
import App from '../app/App';
import {
  MemoryRouter,
  Route,
} from 'react-router-dom'
import { Server } from '../api/server';

interface Props {
  server:Server;
  editor:ConfigEditor.Editor|undefined;
}

export default class DemoApp extends Component<Props> {
  render() {
    return (
      <MemoryRouter initialEntries={[`/${this.props.server.getProjectId()}`]}>
        <Route path="/:projectId" render={props => (
          <App
            {...props}
            supressCssBaseline
            serverOverride={this.props.server} />
        )} />
      </MemoryRouter>
    );
  }
}
