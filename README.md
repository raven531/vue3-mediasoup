# Vue3 Mediasoup Video Rooms

A standalone WebRTC video conferencing application built with Vue 3 and Mediasoup.

## Features

- Multi-participant video conferencing
- Real-time audio and video communication
- Room creation and management
- Responsive design for desktop and mobile devices

## Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/vue3-mediasoup.git
cd vue3-mediasoup
npm install
```

## SSL Certificates

The application requires SSL certificates for secure WebRTC connections. SSL certificates are located in the `ssl` directory.

If you need to generate new certificates for development:

```bash
# Navigate to the ssl directory
cd ssl

# Generate a self-signed certificate
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
```

## Configuration

Edit the `.env` file to configure your environment variables:

```
# .env
MEDIASOUP_ANNOUNCED_IP=127.0.0.1  # Your public IP address
```

## Development

Start the development server:

```bash
npm run dev
```

This will launch both the Vue frontend and the Mediasoup backend server.

## Production Build

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Docker

Build and run with Docker:

```bash
# Build the Docker image
docker build -t vue3-mediasoup .

# Run the container
docker run -p 3016:3016 -p 10000-10100:10000-10100/udp vue3-mediasoup
```

## Project Structure

- `/public` - Static assets and HTML template
- `/src` - Vue 3 frontend application
- `/server` - Mediasoup backend server
- `/ssl` - SSL certificates for HTTPS

## License

This project is licensed under the ISC License. 