# FixMate Server — REST API & Authentication Engine

Backend service powering the FixMate Smart Device & Home Appliance Repair Platform. Built with Express, MongoDB, JWT authentication, and Stripe Payments.

---

## 🔑 Test Credentials
- **Admin**: `admin@fixmate.com` / `Admin123!`
- **Technician**: `rahim@fixmate.com` / `Tech123!`
- **Customer**: `sakib@fixmate.com` / `Customer123!`

---

## 📡 API Endpoints

### Public Routes
- `GET /api/services`: Paginated, searchable, filterable, sortable approved services
- `GET /api/services/:id`: Fetch individual approved service details
- `POST /api/auth/register`: Register new customer or technician
- `POST /api/auth/login`: Authenticate and issue JWT token

### Customer Routes (`verifyToken`, `verifyCustomer`)
- `POST /api/bookings`: Create a repair request
- `GET /api/bookings/my`: Customer's booking list
- `PATCH /api/bookings/:id/cancel`: Cancel a requested booking
- `POST /api/payments/create-checkout-session`: Initiate Stripe Checkout for completed booking
- `GET /api/payments/verify`: Confirm Stripe session payment
- `GET /api/payments/my`: Customer's transaction history

### Technician Routes (`verifyToken`, `verifyTechnician`)
- `POST /api/services`: Submit new service (pending approval)
- `GET /api/services/my`: Technician's service list
- `PATCH /api/services/:id`: Update service (reverts to pending)
- `DELETE /api/services/:id`: Delete service
- `PATCH /api/services/:id/availability`: Toggle service availability
- `GET /api/bookings/technician`: Incoming requests for technician
- `PATCH /api/bookings/:id/status`: Pipeline transition (`requested` → `accepted`/`rejected` → `in-progress` → `completed`)
- `GET /api/technician/dashboard`: Technician overview counts

### Admin Routes (`verifyToken`, `verifyAdmin`)
- `GET /api/admin/dashboard`: Platform counts (users, technicians, pending services, bookings, revenue)
- `GET /api/admin/users`: All registered platform users
- `PATCH /api/admin/users/:id/role`: Change user role (`customer`, `technician`, `admin`)
- `GET /api/admin/services`: All services with status filter
- `PATCH /api/admin/services/:id/approval`: Approve or reject service
- `GET /api/admin/bookings`: Platform-wide booking audit
- `GET /api/admin/payments`: Transaction history & total gross revenue
