# Use the official Node.js image (slim variant for smaller size)
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only (use npm ci for reproducible builds)
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the rest of the application
COPY . .

# Expose the port (Railway respects the PORT env var)
ENV PORT=3000
EXPOSE 3000

# Use a non-root user for security (node user exists in node:* images)
USER node

# Start the server
CMD ["node", "server.js"]
