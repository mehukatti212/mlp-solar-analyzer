FROM nginx:alpine

# Install apache2-utils to generate the htpasswd file
RUN apk add --no-cache apache2-utils

# Remove default nginx config and copy our own
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy our static app files
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

# Create a startup script that generates the .htpasswd file from Environment Variables,
# then starts Nginx.
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'if [ -n "$AUTH_USERNAME" ] && [ -n "$AUTH_PASSWORD" ]; then' >> /start.sh && \
    echo '  echo "Setting up basic auth..."' >> /start.sh && \
    echo '  htpasswd -bc /etc/nginx/.htpasswd "$AUTH_USERNAME" "$AUTH_PASSWORD"' >> /start.sh && \
    echo 'else' >> /start.sh && \
    echo '  echo "ERROR: AUTH_USERNAME and AUTH_PASSWORD must both be set. Refusing to start without credentials." >&2' >> /start.sh && \
    echo '  exit 1' >> /start.sh && \
    echo 'fi' >> /start.sh && \
    echo 'exec nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

# Cloud Run expects the container to listen on port 8080 by default
EXPOSE 8080

CMD ["/start.sh"]
