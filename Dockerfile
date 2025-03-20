FROM node:18

WORKDIR /app

RUN apt-get update

COPY package.json .
COPY package-lock.json .

RUN npm i

COPY src src
COPY ssl ssl
COPY public public

EXPOSE 3016
EXPOSE 10000-10100

RUN npm i -g nodemon

CMD npm start
