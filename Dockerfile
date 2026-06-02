FROM node:18-slim
RUN apt-get update && apt-get install -y curl unzip bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
EXPOSE 8001
CMD ["npm", "start"]
