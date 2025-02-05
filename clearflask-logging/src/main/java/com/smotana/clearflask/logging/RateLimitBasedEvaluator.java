// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.logging;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.boolex.EvaluationException;
import ch.qos.logback.core.boolex.EventEvaluatorBase;
import com.google.common.util.concurrent.LoggingRateLimiters;
import com.google.common.util.concurrent.RateLimiter;

public class RateLimitBasedEvaluator extends EventEvaluatorBase<ILoggingEvent> {
    private volatile RateLimiter rateLimiter;
    private long oncePerSeconds;

    public RateLimitBasedEvaluator() {
        setOncePerSeconds(600); // 10 minutes default
    }

    public void setOncePerSeconds(long oncePerSeconds) {
        this.rateLimiter = LoggingRateLimiters.create(1d / oncePerSeconds, oncePerSeconds, oncePerSeconds);
        this.oncePerSeconds = oncePerSeconds;
    }

    public long getOncePerSeconds() {
        return oncePerSeconds;
    }

    @Override
    public boolean evaluate(ILoggingEvent event) throws NullPointerException, EvaluationException {
        if (event.getLevel().levelInt >= Level.ERROR_INT) {
            return true;
        }
        return rateLimiter.tryAcquire();
    }
}
