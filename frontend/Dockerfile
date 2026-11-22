# --- build: compile the Angular app ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install
COPY . .
RUN yarn build

# --- run: nginx serves the app and forwards /api to the backend ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/demoapp/browser /usr/share/nginx/html
EXPOSE 80
