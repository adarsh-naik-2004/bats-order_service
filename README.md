# CRICSTORE ORDER SERVICE

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the application](#running-the-application)
- [API Documentation](#api-documentation)
  - [Order Routes](#order-routes)
  - [Customer Routes](#customer-routes)
  - [Coupon Routes](#coupon-routes)
  - [Payment Routes](#payment-routes)
- [Project Structure](#project-structure)
- [Deployment](#deployment)

---

## Project Overview

This project is a TypeScript-based microservice for handling orders, customers, and coupons, part of the larger "CRICSTORE" e-commerce ecosystem. Built with **Node.js** and **Express**, it uses **MongoDB** with **Mongoose** for data persistence. The service integrates with **Razorpay** for payment processing, communicates with other services via a **Notification Service** and **WebSocket Notifier**, and uses **Kafka** for handling asynchronous events like product updates.

---

## Features

-   **Order Management:** End-to-end order processing from creation to status updates.
-   **Payment Integration:** Seamlessly integrates with Razorpay for card payments and handles payment webhooks for status updates.
-   **Customer Management:** Manages customer profiles and addresses.
-   **Coupon System:** Supports creating, validating, and managing discount coupons.
-   **Real-time Notifications:** Sends real-time order updates to clients via WebSockets and dispatches notifications through a dedicated notification service.
-   **Asynchronous Caching:** Consumes Kafka messages to keep local caches of product and accessory pricing data synchronized.
-   **Role-Based Access Control (RBAC):** Endpoints are secured based on user roles (Admin, Manager, Customer) using JWT authentication.
-   **Idempotency:** Ensures that duplicate requests for order creation are handled safely to prevent creating multiple orders for the same transaction.

---

## Getting Started

### Prerequisites

-   Node.js (v22.14.0)
-   MongoDB
-   Kafka Broker
-   Razorpay Account (for API keys)
-   npm (Node Package Manager)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/adarsh-naik-2004/bats-order_service.git
    cd bats-order_service
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Configuration

Create a `.env` file in the root directory by copying the `.env.example` file. Fill in the required environment variables:
```
PORT=...
NODE_ENV=...
DB_URL=...
JWKS_URI=...
KAFKA_BROKER=...
KAFKA_USERNAME=...
KAFKA_PASSWORD=...
CLIENT_UI=...
ADMIN_UI=...
RAZORPAY_KEY_ID=...
RAZORPAY_SECRET_KEY=...
RAZORPAY_WEBHOOK_SECRET=...
NOTIFICATION_SERVICE_URL=...
COLLECTION_SERVICE_URL=...
WEBSOCKET_SERVICE_URL=...
```

### Running the application

1.  **Start the development server:**
    ```bash
    npm run dev
    ```

The application will connect to the database and start listening on the port specified in your `.env` file.

---

## API Documentation

### Order Routes

-   `POST /orders`: Creates a new order. Requires authentication.
-   `GET /orders`: Retrieves all orders (Admin/Manager only). Supports pagination and filtering by `storeId`.
-   `GET /orders/mine`: Retrieves orders for the currently authenticated customer.
-   `GET /orders/:orderId`: Retrieves a single order by its ID. Access is restricted based on user role.
-   `PATCH /orders/change-status/:orderId`: Updates the status of an order (Admin/Manager only).

### Customer Routes

-   `GET /customer`: Retrieves the customer profile for the authenticated user. Creates one if it doesn't exist.
-   `PATCH /customer/addresses/:id`: Adds a new address to a customer's profile.

### Coupon Routes

-   `POST /coupons`: Creates a new coupon.
-   `POST /coupons/verify`: Verifies if a coupon code is valid for a given store.
-   `GET /coupons`: Retrieves all coupons with pagination and filtering.
-   `PUT /coupons/:id`: Updates an existing coupon.
-   `DELETE /coupons/:id`: Deactivates a coupon.
-   `POST /coupons/:id/reactivate`: Reactivates a deactivated coupon.

### Payment Routes

-   `POST /payment/webhook`: Handles incoming webhooks from Razorpay to update payment status.

---

## Project Structure

The project is organized into modules, each responsible for a specific domain.

-   `src/`: Main source code directory.
    -   `order/`: Contains logic, routes, and models for order management.
    -   `customer/`: Manages customer data and addresses.
    -   `coupon/`: Handles all coupon-related functionalities.
    -   `payment/`: Integrates with the payment gateway (Razorpay).
    -   `productCache/`, `accessoryCache/`: Manages local caches for pricing information consumed from Kafka.
    -   `services/`: Contains services for communicating with external systems like Notification and WebSocket services.
    -   `common/`: Includes shared middlewares, types, and utility functions.
    -   `config/`: Contains configuration files for database, logger, and environment variables.
-   `server.ts`: The entry point for the application.

---

## Deployment

The project includes Docker configurations for easy deployment in both development and production environments.

-   **Development:** `docker/dev/Dockerfile` sets up a container with hot-reloading for development.
-   **Production:** `docker/prod/Dockerfile` builds a lean, multi-stage image optimized for production deployment.

To build and push the production Docker image, you can use the CI workflow defined in `.github/workflows/ci.yaml` or run the build command manually:

```bash
# Build the image
docker build -f docker/prod/Dockerfile -t your-docker-hub-username/order-service .

# Run the container
docker run -p <port>:<port> -e "NODE_ENV=production" your-docker-hub-username/order-service
