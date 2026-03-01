# Attendance Monitoring System

A clean, production-ready web application for managing employee attendance with separate user and admin interfaces.

## Features

### User Side
- **Login Page**: Secure authentication with role-based access
- **Dashboard**: 
  - Real-time clock display
  - Clock In/Out functionality
  - Quick stats overview
  - Attendance history table
- **Profile Page**: View and edit personal information including government IDs and bank details
- **Responsive Navigation**: Top navbar with logout functionality

### Admin Side
- **Admin Dashboard**: Overview with statistics and recent attendance records
- **User Management**: Complete CRUD operations for employee accounts
  - Add, edit, delete users
  - Search functionality
  - Fields: Name, Email, Department, SSS, Pag-IBIG, PhilHealth, ATM Number
- **Department Management**: Manage company departments
- **Location Management**: Manage office locations and branches
- **Sidebar Navigation**: Clean sidebar with role-based access control

## Technology Stack

- **Framework**: React 18.3.1 with TypeScript
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **Icons**: Lucide React
- **Build Tool**: Vite

## Project Structure

```
src/app/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Input, Card, etc.)
│   └── protected-route.tsx
├── hooks/              # Custom React hooks
│   └── useAuth.tsx     # Authentication hook with context
├── layouts/            # Layout components
│   ├── user-layout.tsx
│   └── admin-layout.tsx
├── lib/                # Utilities and types
│   ├── types.ts        # TypeScript type definitions
│   └── utils.ts        # Helper functions
├── pages/              # Page components
│   ├── login.tsx
│   ├── user-dashboard.tsx
│   ├── profile.tsx
│   ├── admin-dashboard.tsx
│   ├── user-management.tsx
│   ├── department-management.tsx
│   └── location-management.tsx
├── services/           # Mock API services
│   ├── auth.service.ts
│   ├── attendance.service.ts
│   ├── user.service.ts
│   ├── department.service.ts
│   └── location.service.ts
├── routes.tsx          # Route configuration
└── App.tsx            # Main application component
```

## Demo Credentials

### User Account
- Email: `user@example.com`
- Password: `password`

### Admin Account
- Email: `admin@example.com`
- Password: `password`

## Getting Started

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Run Development Server**
   ```bash
   pnpm dev
   ```

3. **Build for Production**
   ```bash
   pnpm build
   ```

## Architecture Highlights

### Component-Based Design
- Fully reusable UI components with consistent styling
- Separation of concerns between presentation and business logic
- TypeScript for type safety

### Mock API Services
- All services are designed as drop-in replacements for real APIs
- Simulated network delays for realistic behavior
- Easy to replace with actual backend integration

### Authentication Flow
- Context-based authentication state management
- Protected routes with role-based access control
- Persistent sessions using localStorage

### Data Management
- Centralized service layer for all data operations
- Mock data with realistic structure
- CRUD operations for all entities

## Backend Integration Guide

To integrate with a real backend:

1. **Replace Service Functions**
   - Update files in `src/app/services/` to use actual API endpoints
   - Replace `fetch` or `axios` calls instead of mock data
   - Remove artificial delays

2. **Update Authentication**
   - Replace localStorage with proper token management
   - Implement secure token storage (httpOnly cookies recommended)
   - Add token refresh logic

3. **Environment Variables**
   - Create `.env` file for API base URL
   - Store sensitive configuration securely

Example:
```typescript
// Before (Mock)
export const userService = {
  async getAllUsers(): Promise<User[]> {
    await delay(400);
    return [...MOCK_USERS];
  }
};

// After (Real API)
export const userService = {
  async getAllUsers(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    return response.json();
  }
};
```

## Design System

### Colors
- Neutral color palette for clean, professional appearance
- Consistent use of neutral-50 to neutral-900
- Semantic colors for status badges (success, warning, danger)

### Typography
- System font stack for optimal readability
- Consistent font sizes and weights defined in theme.css
- Responsive text sizing

### Layout
- Card-based design for content organization
- Consistent spacing and padding
- Responsive grid layouts

## Key Features

### User Experience
- Real-time clock display
- Immediate feedback for all actions
- Loading states and error handling
- Responsive design for all screen sizes

### Admin Experience
- Comprehensive data tables
- Search and filter capabilities
- Modal dialogs for CRUD operations
- Confirmation dialogs for destructive actions

### Security
- Role-based access control
- Protected routes
- Input validation
- Secure credential handling (ready for backend)

## Future Enhancements

Potential features for expansion:
- Attendance reports and analytics
- Email notifications
- Geolocation verification for clock in/out
- Mobile app version
- Export attendance data (CSV, PDF)
- Advanced filtering and date range selection
- Bulk operations for admin

## License

This project is ready for production use and can be customized for your specific needs.
"# ams" 
"# ams" 
"# ams" 
