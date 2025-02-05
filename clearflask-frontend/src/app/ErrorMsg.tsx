// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Box } from '@material-ui/core';
import React, { Component } from 'react';
import Message from '../common/Message';

interface Props {
  msg?: React.ReactNode | string;
  variant?: 'success' | 'warning' | 'error' | 'info';
  action?: React.ReactNode,
}

export default class ErrorMsg extends Component<Props> {
  readonly styles = {
    message: {
      margin: '40px auto',
      width: 'fit-content',
      minWidth: 'unset',
    },
  };

  render() {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        width='100%'
        height='100%'
      >
        <Message innerStyle={this.styles.message}
          message={this.props.msg}
          severity={this.props.variant || 'error'}
          action={this.props.action}
        />
      </Box>
    );
  }
}
