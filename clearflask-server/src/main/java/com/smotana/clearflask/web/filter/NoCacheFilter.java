package com.smotana.clearflask.web.filter;

import com.smotana.clearflask.core.VeruvInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.*;
import javax.servlet.http.HttpServletResponse;

@Slf4j
public class NoCacheFilter implements Filter {

    public NoCacheFilter() {
        VeruvInjector.INSTANCE.get().injectMembers(this);
    }

    public void doFilter(ServletRequest request, ServletResponse response,
                         FilterChain chain) throws java.io.IOException, ServletException {

        HttpServletResponse res = (HttpServletResponse) response;
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("test", "test");

        chain.doFilter(request, response);
    }

    @Override
    public void init(FilterConfig arg0) throws ServletException {
    }

    @Override
    public void destroy() {
    }
}
