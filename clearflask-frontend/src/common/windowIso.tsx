// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { StaticRouterContext } from 'react-router';
import { Store } from 'redux';
import { ReduxState } from '../api/server';
import { ReduxStateAdmin } from '../api/serverAdmin';

export interface StoresState {
  serverAdminStore?: Store<ReduxStateAdmin, any>,
  serverStores?: { [projectId: string]: Store<ReduxState, any> },
}

export interface StoresStateSerializable {
  serverAdminStore?: ReduxStateAdmin,
  serverStores?: { [projectId: string]: ReduxState },
}

var win: any;
if (typeof window !== "undefined") {
  win = window;
  win.isSsr = false;
} else if (typeof global !== "undefined") {
  win = global;
  win.isSsr = true;
  /* eslint-disable-next-line no-restricted-globals */
} else if (typeof self !== "undefined") {
  /* eslint-disable-next-line no-restricted-globals */
  win = self;
  win.isSsr = true;
} else {
  win = {};
  win.isSsr = true;
}
if (!win.ENV) {
  win.ENV = 'production';
}
if (!win.parentDomain) {
  win.parentDomain = 'clearflask.com';
}

export const WindowIsoSsrProvider = (props: {
  children: React.ReactElement;
  fetch: any;
  apiBasePath: string;
  env: 'development' | 'production' | 'local' | 'test';
  url: string;
  setTitle: (title: string) => void;
  setMaxAge: (maxAge: number) => void;
  storesState: StoresState;
  awaitPromises: Array<Promise<any>>;
  staticRouterContext: StaticRouterContext;
  parentDomain: string;
}) => {
  win['ENV'] = props.env;
  win['fetch'] = props.fetch;
  win['apiBasePath'] = props.apiBasePath;
  const url = new URL(props.url);
  win['location'] = url;
  win['setTitle'] = props.setTitle;
  win['setMaxAge'] = props.setMaxAge;
  win['storesState'] = props.storesState;
  win['awaitPromises'] = props.awaitPromises;
  win['staticRouterContext'] = props.staticRouterContext;
  win['parentDomain'] = props.parentDomain;
  return props.children;
};

export type WindowIso = {
  // Both CSR and SSR
  parentDomain: string;
  ENV?: 'development' | 'production' | 'selfhost' | 'local' | 'test';
} & (( // CSR only
  Window & typeof globalThis & {
    isSsr: false;
  }
) | ( // SSR only
    NodeJS.Global & {
      isSsr: true;
      fetch: any;
      apiBasePath: string;
      location: URL;
      setTitle: (title: string) => void;
      setMaxAge: (maxAge: number) => void;
      storesState: StoresState;
      awaitPromises: Array<Promise<any>>;
      staticRouterContext: StaticRouterContext;
    }
  ));

const windowIso: WindowIso = win;
export default windowIso;