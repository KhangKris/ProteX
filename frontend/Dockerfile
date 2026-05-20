FROM node:18-alpine

WORKDIR /app

# Copy package descriptors first to leverage Docker layer cache
COPY package.json ./

# Install npm dependencies
RUN npm install

# Copy application source files
COPY . .

EXPOSE 5173

# Start Vite dev server exposing on 0.0.0.0 via --host option
CMD ["npm", "run", "dev"]
