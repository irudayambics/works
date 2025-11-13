FROM node:20-alpine

# Install Python and build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build Next.js app
ENV NODE_ENV=production
ENV NEXT_PUBLIC_RP_ID=ai-sdlc-workshop-day1-production.up.railway.app
RUN npm run build

# Create todos.db file with correct permissions
RUN touch /app/todos.db

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_PUBLIC_RP_ID=ai-sdlc-workshop-day1-production.up.railway.app

CMD ["npm", "start"]
