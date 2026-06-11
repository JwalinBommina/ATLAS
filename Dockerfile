FROM n8nio/n8n:2.17.6

USER root

RUN wget https://gitlab.alpinelinux.org/api/v4/projects/5/packages/generic/v2.14.4/x86_64/apk.static && chmod +x apk.static && ./apk.static -X http://dl-cdn.alpinelinux.org/alpine/v3.22/main -U --allow-untrusted --initdb add apk-tools && rm apk.static

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont dbus xvfb x11vnc fluxbox novnc bash font-noto-emoji

RUN npm install -g playwright openai
RUN npx playwright install

ENV NODE_PATH=/usr/local/lib/node_modules
ENV NODE_FUNCTION_ALLOW_BUILTIN=fs

RUN mkdir -p /home/node/scripts/auth_state

COPY apply.js /home/node/scripts/
COPY fetch.js /home/node/scripts/
COPY builtin.js /home/node/scripts/

RUN chown -R node:node /home/node
RUN chmod -R 777 /home/node/scripts
RUN chmod -R 777 /home/node/scripts/auth_state

USER node