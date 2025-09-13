# Development stage
FROM node:24-alpine as development
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Set default development environment variables
ENV REACT_APP_API_BASE_URL=http://localhost:8000/api
ENV REACT_APP_SERVER_URL=http://localhost:8000
ENV REACT_APP_PIXABAY_API_KEY=51815028-d9f2434e9b26002e4b2bd4fa4
ENV REACT_APP_PIXABAY_BASE_URL=https://pixabay.com/api/videos/
ENV REACT_APP_ENV=local

EXPOSE 3000
CMD ["npm", "start"]

# Build stage for production
FROM node:24-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Set build-time environment variables for React
ENV REACT_APP_PIXABAY_API_KEY=51815028-d9f2434e9b26002e4b2bd4fa4
ENV REACT_APP_PIXABAY_BASE_URL=https://pixabay.com/api/videos/

RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Set default environment variables
ENV SERVER_HOST=localhost

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]