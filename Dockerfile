FROM node:8.10.0-alpine

# Create app directory
WORKDIR /home/usr/app

# Install Utilities
RUN apk add --no-cache git

RUN apk add --no-cache bash

#make the logfile directory
RUN mkdir log
# RUN mkdir uploads
# RUN mkdir upload_bkup
# RUN mkdir scheduler_error_data


ENV LOG_FOLDER /home/usr/app/log/
# ENV UPLOAD_FILE_PATH /home/usr/app/uploads/
# ENV UPLOAD_BKUP_FILE_PATH /home/usr/app/upload_bkup/
# ENV ERROR_FILE_PATH /home/usr/app/scheduler_error_data/


# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install --production
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8080
# ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.5.1/wait /wait
# RUN chmod +x /wait

CMD  [ "node", "server.js"]
