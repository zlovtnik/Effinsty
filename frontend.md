# Effinsty Frontend Development Specification

**Version:** 1.0  
**Date:** 2026-03-12  
**Technology Stack:** Svelte 5, TypeScript, Bun, Vite, TailwindCSS

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Project Structure](#project-structure)
6. [Authentication & Authorization](#authentication--authorization)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [UI Components](#ui-components)
10. [Pages & Routes](#pages--routes)
11. [Error Handling](#error-handling)
12. [Performance & Optimization](#performance--optimization)
13. [Testing Strategy](#testing-strategy)
14. [Security Considerations](#security-considerations)
15. [Accessibility & Internationalization](#accessibility--internationalization)
16. [Development Workflow](#development-workflow)
17. [Deployment](#deployment)
18. [Monitoring & Analytics](#monitoring--analytics)

---

## Executive Summary

This document defines the complete frontend specification for **Effinsty**, a multi-tenant SaaS contact management application. The frontend is built with **Svelte 5** and **TypeScript**, leveraging modern tooling with **Bun** as the package manager and runtime, and **Vite** for bundling and development.

The application provides:
- Secure JWT-based authentication with refresh token rotation
- Multi-tenant support with tenant context management
- Contact CRUD operations with metadata support
- Responsive, accessible UI with TailwindCSS
- Comprehensive error handling and user feedback
- Production-ready performance and security practices

---

## Project Overview

### Goals

1. **User Authentication**: Implement secure login/logout with JWT token management
2. **Contact Management**: Create, read, update, delete contacts with advanced filtering and pagination
3. **Responsive Design**: Mobile-first, accessible interface across all devices
4. **Error Resilience**: Graceful error handling with user-friendly messaging
5. **Performance**: Optimized load times, lazy loading, and efficient state management
6. **Developer Experience**: Type-safe, well-documented, maintainable codebase

### Key Features

- **Authentication Module**: Login, logout, token refresh with automatic expiration handling
- **Dashboard**: Overview of contacts with quick statistics
- **Contact List**: Paginated contact listing with search and filter capabilities
- **Contact Detail**: Full contact information with editing capabilities
- **Contact Create/Edit**: Form-based contact management with validation
- **Settings**: User profile and tenant settings management
- **Error Boundaries**: Graceful error handling with recovery options
- **Loading States**: Skeleton screens and loading indicators
- **Offline Support**: Basic offline mode with sync queue (optional)

---

## Technology Stack

### Core Dependencies

```json
{
  "dependencies": {
    "svelte": "^5.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "axios": "^1.6.0",
    "zod": "^3.22.0",
    "clsx": "^2.0.0",
    "lucide-svelte": "^0.292.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "svelte-check": "^3.6.0",
    "prettier": "^3.1.0",
    "eslint": "^8.0.0",
    "typescript-eslint": "^6.0.0"
  }
}
```

### Build & Development Tools

- **Bun**: Package manager and runtime (v1.0+)
- **Vite**: Build tool and dev server with HMR
- **TypeScript**: Type safety and better developer experience
- **TailwindCSS**: Utility-first CSS framework
- **Prettier**: Code formatting
- **ESLint**: Code quality and consistency
- **Vitest**: Unit and integration testing

### Runtime Environment

- **Node.js**: v20+ (with Bun compatibility)
- **Browsers**: Modern browsers supporting ES2020+

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│         Svelte Components Layer              │
│  (Pages, Layouts, Components, Stores)       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│     State Management & Stores (Svelte)      │
│  (Authentication, Contacts, UI State)       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      API Client & Services Layer            │
│  (HTTP Client, Auth Service, Contact API)   │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│     HTTP Layer (Axios with Interceptors)    │
│  (Token Management, Error Handling)         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
        Effinsty Backend API (REST)
```

### Design Patterns

1. **Stores as State Management**: Svelte writable stores for reactive state
2. **Service Layer**: Encapsulation of API calls and business logic
3. **Component Composition**: Reusable, composable UI components
4. **Custom Hooks**: Reusable logic with Svelte `use:` directives
5. **Error Boundaries**: Components that catch and handle errors gracefully
6. **Optimistic Updates**: Immediate UI updates with rollback on failure

---

## Project Structure

```
effinsty-frontend/
├── src/
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts              # Axios instance with interceptors
│   │   │   ├── types.ts               # API request/response types
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts    # Authentication API calls
│   │   │   │   ├── contacts.service.ts # Contact API calls
│   │   │   │   └── index.ts           # Service barrel exports
│   │   │   └── errors.ts              # API error handling
│   │   ├── stores/
│   │   │   ├── auth.store.ts          # Authentication state
│   │   │   ├── contacts.store.ts      # Contacts state
│   │   │   ├── ui.store.ts            # UI state (modals, notifications)
│   │   │   ├── tenant.store.ts        # Tenant context state
│   │   │   └── index.ts               # Store exports
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Button.svelte
│   │   │   │   ├── Input.svelte
│   │   │   │   ├── Modal.svelte
│   │   │   │   ├── Card.svelte
│   │   │   │   ├── Spinner.svelte
│   │   │   │   ├── Alert.svelte
│   │   │   │   ├── Toast.svelte
│   │   │   │   ├── Pagination.svelte
│   │   │   │   ├── Badge.svelte
│   │   │   │   └── Skeleton.svelte
│   │   │   ├── layout/
│   │   │   │   ├── Header.svelte
│   │   │   │   ├── Sidebar.svelte
│   │   │   │   ├── Footer.svelte
│   │   │   │   └── Layout.svelte
│   │   │   ├── forms/
│   │   │   │   ├── LoginForm.svelte
│   │   │   │   ├── ContactForm.svelte
│   │   │   │   └── SearchForm.svelte
│   │   │   └── contacts/
│   │   │       ├── ContactList.svelte
│   │   │       ├── ContactCard.svelte
│   │   │       ├── ContactDetail.svelte
│   │   │       └── ContactActions.svelte
│   │   ├── utils/
│   │   │   ├── validation.ts          # Form validation schemas
│   │   │   ├── formatting.ts          # Data formatting utilities
│   │   │   ├── dates.ts               # Date utilities
│   │   │   ├── storage.ts             # Local storage utilities
│   │   │   ├── logger.ts              # Client-side logging
│   │   │   └── constants.ts           # App constants
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts     # Route guards
│   │   │   └── error.middleware.ts    # Error handling
│   │   └── types/
│   │       ├── api.ts                 # API types (matching backend)
│   │       ├── domain.ts              # Domain types
│   │       └── forms.ts               # Form types
│   ├── routes/
│   │   ├── +layout.svelte             # Root layout
│   │   ├── +page.svelte               # Home/landing page
│   │   ├── +error.svelte              # Error page
│   │   ├── login/
│   │   │   └── +page.svelte
│   │   ├── dashboard/
│   │   │   ├── +layout.svelte         # Authenticated layout
│   │   │   ├── +page.svelte           # Dashboard
│   │   │   ├── contacts/
│   │   │   │   ├── +page.svelte       # Contacts list
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── +page.svelte   # Contact detail
│   │   │   │   │   └── edit/
│   │   │   │   │       └── +page.svelte
│   │   │   │   └── new/
│   │   │   │       └── +page.svelte
│   │   │   ├── settings/
│   │   │   │   └── +page.svelte
│   │   │   └── logout/
│   │   │       └── +page.svelte
│   │   └── 404/
│   │       └── +page.svelte
│   ├── hooks.client.ts                # Client-side hooks
│   ├── hooks.server.ts                # Server-side hooks (optional)
│   └── app.ts                         # App configuration
├── tests/
│   ├── unit/
│   │   ├── stores.test.ts
│   │   ├── services.test.ts
│   │   └── utils.test.ts
│   ├── integration/
│   │   ├── auth.test.ts
│   │   └── contacts.test.ts
│   └── e2e/
│       └── flows.test.ts
├── public/
│   ├── favicon.ico
│   ├── manifest.json
│   └── robots.txt
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── svelte.config.js
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
├── bun.lockb
├── package.json
├── README.md
└── DEVELOPMENT.md
```

---

## Authentication & Authorization

### Authentication Flow

#### 1. **Login Flow**

```
User Input (username/password)
         │
         ▼
  Validate Input (Zod)
         │
         ▼
  Call AuthService.login()
         │
         ▼
  Receive tokens (access + refresh)
         │
         ▼
  Store tokens (memory + secure cookie)
         │
         ▼
  Update auth store
         │
         ▼
  Redirect to dashboard
```

#### 2. **Token Management**

- **Access Token Storage**: Memory (runtime) for security
- **Refresh Token Storage**: HttpOnly cookie (secure, inaccessible to JS)
- **Token Expiration**: Monitored via `ExpiresAt` from API response
- **Automatic Refresh**: Triggered before expiration or on 401 response

#### 3. **Protected Routes**

```typescript
// lib/middleware/auth.middleware.ts
export function requireAuth(url: string, token?: string): boolean {
  const publicRoutes = ['/login', '/'];
  
  if (publicRoutes.includes(url)) return true;
  
  return !!token;
}

export function redirectToLogin(url: string): void {
  goto('/login?redirect=' + encodeURIComponent(url));
}
```

### Implementation Details

#### AuthService

```typescript
// lib/api/services/auth.service.ts

export class AuthService {
  async login(
    tenant: string,
    username: string,
    password: string,
  ): Promise<AuthToken> {
    const response = await apiClient.post<AuthToken>('/auth/login', {
      username,
      password,
    }, {
      headers: { 'X-Tenant-ID': tenant }
    });
    return response.data;
  }

  async refresh(refreshToken: string): Promise<AuthToken> {
    const response = await apiClient.post<AuthToken>('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', {
      refreshToken,
    });
  }
}
```

#### Auth Store

```typescript
// lib/stores/auth.store.ts

export const authStore = writable<AuthState>({
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  expiresAt: null,
  loading: false,
  error: null,
});

export const login = async (
  tenant: string,
  username: string,
  password: string,
) => {
  authStore.update(s => ({ ...s, loading: true, error: null }));
  try {
    const token = await authService.login(tenant, username, password);
    authStore.update(s => ({
      ...s,
      isAuthenticated: true,
      token: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: new Date(token.expiresAt),
      loading: false,
    }));
    setupTokenRefresh(token);
  } catch (error) {
    authStore.update(s => ({
      ...s,
      error: getErrorMessage(error),
      loading: false,
    }));
  }
};
```

#### API Interceptors

```typescript
// lib/api/client.ts

export const setupInterceptors = () => {
  apiClient.interceptors.request.use((config) => {
    const { token } = get(authStore);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (!config.headers['X-Tenant-ID']) {
      const { tenant } = get(tenantStore);
      if (tenant) {
        config.headers['X-Tenant-ID'] = tenant.id;
      }
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const { refreshToken } = get(authStore);
          const newToken = await authService.refresh(refreshToken);
          authStore.update(s => ({
            ...s,
            token: newToken.accessToken,
            refreshToken: newToken.refreshToken,
            expiresAt: new Date(newToken.expiresAt),
          }));
          originalRequest.headers.Authorization = `Bearer ${newToken.accessToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          logout();
          goto('/login');
          throw refreshError;
        }
      }
      
      return Promise.reject(error);
    },
  );
};
```

### Tenant Context

```typescript
// lib/stores/tenant.store.ts

export const tenantStore = writable<TenantState>({
  id: null,
  loading: false,
  error: null,
});

// Set tenant from header or config
export const setTenant = (tenantId: string) => {
  tenantStore.set({ id: tenantId, loading: false, error: null });
};
```

---

## State Management

### Store Architecture

Using Svelte 5's built-in stores (writable, readable, derived) with TypeScript for type safety.

#### 1. **Auth Store**

```typescript
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  loading: boolean;
  error: string | null;
}
```

#### 2. **Contacts Store**

```typescript
interface ContactsState {
  items: Contact[];
  currentContact: Contact | null;
  page: number;
  pageSize: number;
  totalCount: number;
  loading: boolean;
  error: string | null;
  filters: ContactFilters;
}

interface ContactFilters {
  search?: string;
  sortBy?: 'name' | 'email' | 'created' | 'updated';
  sortOrder?: 'asc' | 'desc';
}
```

#### 3. **UI Store**

```typescript
interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
  modals: {
    contactForm: boolean;
    confirmDelete: boolean;
    [key: string]: boolean;
  };
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}
```

#### 4. **Tenant Store**

```typescript
interface TenantState {
  id: string | null;
  schema?: string;
  loading: boolean;
  error: string | null;
}
```

### Store Composition

```typescript
// lib/stores/index.ts
export { authStore, login, logout, refreshToken } from './auth.store';
export { contactsStore, fetchContacts, createContact, updateContact, deleteContact } from './contacts.store';
export { uiStore, notify, closeNotification } from './ui.store';
export { tenantStore, setTenant } from './tenant.store';

// Usage in components
<script lang="ts">
  import { authStore, contactsStore } from '$lib/stores';
</script>
```

### Derived Stores

```typescript
// Computed/derived state
export const isTokenExpiring = derived(authStore, ($auth) => {
  if (!$auth.expiresAt) return false;
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  return $auth.expiresAt.getTime() - now.getTime() < fiveMinutes;
});

export const hasContacts = derived(contactsStore, ($contacts) => {
  return $contacts.items.length > 0;
});
```

---

## API Integration

### API Types

```typescript
// lib/types/api.ts

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface ContactCreateRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  metadata?: Record<string, string>;
}

export interface ContactUpdateRequest extends Partial<ContactCreateRequest> {}

export interface ContactResponse {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details: string[];
  correlationId: string;
}
```

### API Client Setup

```typescript
// lib/api/client.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  withCredentials: true,
});

// Add correlation ID to requests
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.headers['X-Correlation-ID']) {
    config.headers['X-Correlation-ID'] = generateCorrelationId();
  }
  return config;
});

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### Services Implementation

#### Auth Service

```typescript
// lib/api/services/auth.service.ts
import { apiClient } from '../client';
import type { AuthToken, LoginRequest } from '../types';

export class AuthService {
  async login(tenant: string, credentials: LoginRequest): Promise<AuthToken> {
    const response = await apiClient.post<AuthToken>('/auth/login', credentials, {
      headers: { 'X-Tenant-ID': tenant },
    });
    return response.data;
  }

  async refresh(refreshToken: string): Promise<AuthToken> {
    const response = await apiClient.post<AuthToken>('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  async logout(refreshToken: string): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken });
  }
}

export const authService = new AuthService();
```

#### Contacts Service

```typescript
// lib/api/services/contacts.service.ts
import { apiClient } from '../client';
import type { ContactResponse, ContactCreateRequest, ContactUpdateRequest, PagedResponse } from '../types';

export class ContactsService {
  async list(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PagedResponse<ContactResponse>> {
    const response = await apiClient.get<PagedResponse<ContactResponse>>('/contacts', {
      params: { page, pageSize },
    });
    return response.data;
  }

  async get(id: string): Promise<ContactResponse> {
    const response = await apiClient.get<ContactResponse>(`/contacts/${id}`);
    return response.data;
  }

  async create(data: ContactCreateRequest): Promise<ContactResponse> {
    const response = await apiClient.post<ContactResponse>('/contacts', data);
    return response.data;
  }

  async update(id: string, data: ContactUpdateRequest): Promise<ContactResponse> {
    const response = await apiClient.put<ContactResponse>(`/contacts/${id}`, data);
    return response.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/contacts/${id}`);
  }
}

export const contactsService = new ContactsService();
```

### Error Handling

```typescript
// lib/api/errors.ts
import type { AxiosError } from 'axios';
import type { ErrorResponse } from './types';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details: string[] = [],
    public correlationId: string = '',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as ErrorResponse;
    return new ApiError(
      error.response?.status || 500,
      response?.code || 'UNKNOWN_ERROR',
      response?.message || error.message,
      response?.details,
      response?.correlationId,
    );
  }
  
  if (error instanceof Error) {
    return new ApiError(0, 'CLIENT_ERROR', error.message);
  }
  
  return new ApiError(0, 'UNKNOWN_ERROR', 'An unknown error occurred');
}
```

---

## UI Components

### Component Philosophy

- **Composability**: Small, focused components that work together
- **Accessibility**: ARIA attributes, semantic HTML, keyboard navigation
- **Responsiveness**: Mobile-first design with TailwindCSS
- **Customization**: Props for styling, content, behavior
- **Type Safety**: Full TypeScript support

### Core Components

#### Button Component

```svelte
<!-- lib/components/common/Button.svelte -->
<script lang="ts">
  import { clsx } from 'clsx';
  
  export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
</script>

<button
  {type}
  disabled={disabled || loading}
  class={clsx(
    'font-medium transition-colors rounded-lg',
    {
      'px-2 py-1 text-sm': size === 'sm',
      'px-4 py-2': size === 'md',
      'px-6 py-3 text-lg': size === 'lg',
      'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400': variant === 'primary',
      'bg-gray-200 text-gray-800 hover:bg-gray-300': variant === 'secondary',
      'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
      'opacity-50 cursor-not-allowed': disabled,
    }
  )}
>
  {#if loading}
    <Spinner size="sm" />
  {/if}
  <slot />
</button>
```

#### Input Component

```svelte
<!-- lib/components/common/Input.svelte -->
<script lang="ts">
  export let type: string = 'text';
  export let placeholder: string = '';
  export let value: string = '';
  export let error: string | undefined = undefined;
  export let disabled: boolean = false;
  export let required: boolean = false;
</script>

<div class="flex flex-col">
  <input
    {type}
    {placeholder}
    {value}
    {disabled}
    {required}
    on:change
    on:input
    class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    class:border-red-500={error}
  />
  {#if error}
    <span class="text-red-500 text-sm mt-1">{error}</span>
  {/if}
</div>
```

#### Modal Component

```svelte
<!-- lib/components/common/Modal.svelte -->
<script lang="ts">
  export let isOpen = false;
  export let title: string = '';
  export let onClose: () => void = () => {};
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
      <div class="flex justify-between items-center p-4 border-b">
        <h2 class="text-lg font-semibold">{title}</h2>
        <button on:click={onClose} class="text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
      </div>
      <div class="p-4">
        <slot />
      </div>
    </div>
  </div>
{/if}
```

#### Toast/Notification Component

```svelte
<!-- lib/components/common/Toast.svelte -->
<script lang="ts">
  import { uiStore, closeNotification } from '$lib/stores';
  
  const variants = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  };
</script>

<div class="fixed bottom-4 right-4 space-y-2">
  {#each $uiStore.notifications as notification (notification.id)}
    <div class={clsx('text-white px-4 py-2 rounded-lg shadow-lg', variants[notification.type])}>
      {notification.message}
    </div>
  {/each}
</div>
```

#### Pagination Component

```svelte
<!-- lib/components/common/Pagination.svelte -->
<script lang="ts">
  export let page: number;
  export let pageSize: number;
  export let totalCount: number;
  export let onPageChange: (page: number) => void;
  
  const totalPages = Math.ceil(totalCount / pageSize);
</script>

<div class="flex items-center justify-between">
  <button 
    on:click={() => onPageChange(page - 1)}
    disabled={page === 1}
    class="px-3 py-1"
  >
    Previous
  </button>
  
  <span>Page {page} of {totalPages}</span>
  
  <button 
    on:click={() => onPageChange(page + 1)}
    disabled={page === totalPages}
    class="px-3 py-1"
  >
    Next
  </button>
</div>
```

#### Card Component

```svelte
<!-- lib/components/common/Card.svelte -->
<script lang="ts">
  export let padding: 'sm' | 'md' | 'lg' = 'md';
</script>

<div class={clsx(
  'bg-white rounded-lg shadow',
  { 'p-2': padding === 'sm', 'p-4': padding === 'md', 'p-6': padding === 'lg' }
)}>
  <slot />
</div>
```

---

## Pages & Routes

### Route Structure

#### 1. **Landing/Home Page** (`+page.svelte`)

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores';
  import { goto } from '$app/navigation';
  
  onMount(() => {
    if ($authStore.isAuthenticated) {
      goto('/dashboard');
    }
  });
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
  <h1 class="text-4xl font-bold mb-4">Effinsty</h1>
  <p class="text-xl text-gray-600 mb-8">Manage your contacts effortlessly</p>
  <Button on:click={() => goto('/login')}>Get Started</Button>
</div>
```

#### 2. **Login Page** (`/login/+page.svelte`)

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores';
  import { goto } from '$app/navigation';
  import LoginForm from '$lib/components/forms/LoginForm.svelte';
  import type { LoginRequest } from '$lib/api/types';
  
  let tenant = '';
  let isLoading = false;
  let error = '';
  
  async function handleLogin(event: CustomEvent<LoginRequest & { tenant: string }>) {
    isLoading = true;
    error = '';
    
    try {
      await authStore.login(event.detail.tenant, event.detail.username, event.detail.password);
      await goto('/dashboard');
    } catch (err) {
      error = getErrorMessage(err);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-50">
  <Card class="w-full max-w-md">
    <h2 class="text-2xl font-bold mb-6">Sign In</h2>
    <LoginForm on:submit={handleLogin} {isLoading} {error} />
  </Card>
</div>
```

#### 3. **Dashboard Layout** (`/dashboard/+layout.svelte`)

```svelte
<script lang="ts">
  import { authStore, tenantStore } from '$lib/stores';
  import { goto } from '$app/navigation';
  
  onMount(() => {
    if (!$authStore.isAuthenticated) {
      goto('/login');
    }
  });
</script>

<div class="flex h-screen bg-gray-100">
  <Sidebar />
  <main class="flex-1 overflow-auto">
    <Header />
    <div class="p-8">
      <slot />
    </div>
  </main>
</div>
```

#### 4. **Contacts List Page** (`/dashboard/contacts/+page.svelte`)

```svelte
<script lang="ts">
  import { contactsStore } from '$lib/stores';
  import { onMount } from 'svelte';
  import ContactList from '$lib/components/contacts/ContactList.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import SearchForm from '$lib/components/forms/SearchForm.svelte';
  
  let searchQuery = '';
  let page = 1;
  
  onMount(async () => {
    await contactsStore.fetchContacts(page, 20);
  });
  
  async function handleSearch(query: string) {
    searchQuery = query;
    page = 1;
    await contactsStore.search(query);
  }
  
  async function handlePageChange(newPage: number) {
    page = newPage;
    await contactsStore.fetchContacts(newPage, 20);
  }
</script>

<div>
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-3xl font-bold">Contacts</h1>
    <Button variant="primary" on:click={() => goto('/dashboard/contacts/new')}>
      Add Contact
    </Button>
  </div>
  
  <SearchForm on:search={(e) => handleSearch(e.detail)} />
  
  {#if $contactsStore.loading}
    <Skeleton count={5} />
  {:else}
    <ContactList 
      contacts={$contactsStore.items}
      on:delete={(e) => contactsStore.deleteContact(e.detail)}
    />
    <Pagination
      page={$contactsStore.page}
      pageSize={$contactsStore.pageSize}
      totalCount={$contactsStore.totalCount}
      onPageChange={handlePageChange}
    />
  {/if}
</div>
```

#### 5. **Contact Detail Page** (`/dashboard/contacts/[id]/+page.svelte`)

```svelte
<script lang="ts">
  import { contactsStore } from '$lib/stores';
  import { page as pageStore } from '$app/stores';
  import { onMount } from 'svelte';
  
  let contactId: string;
  
  onMount(async () => {
    contactId = $pageStore.params.id;
    await contactsStore.fetchContact(contactId);
  });
</script>

<div>
  {#if $contactsStore.loading}
    <Skeleton />
  {:else if $contactsStore.currentContact}
    <ContactDetail contact={$contactsStore.currentContact} />
  {:else}
    <Alert type="error" message="Contact not found" />
  {/if}
</div>
```

#### 6. **Contact Create/Edit Page** (`/dashboard/contacts/new/+page.svelte` and `/[id]/edit/+page.svelte`)

```svelte
<script lang="ts">
  import { contactsStore } from '$lib/stores';
  import { goto } from '$app/navigation';
  import { page as pageStore } from '$app/stores';
  import ContactForm from '$lib/components/forms/ContactForm.svelte';
  import type { ContactCreateRequest } from '$lib/api/types';
  
  let contactId: string | undefined;
  let isLoading = false;
  
  onMount(async () => {
    contactId = $pageStore.params.id;
    if (contactId) {
      await contactsStore.fetchContact(contactId);
    }
  });
  
  async function handleSubmit(event: CustomEvent<ContactCreateRequest>) {
    isLoading = true;
    try {
      if (contactId) {
        await contactsStore.updateContact(contactId, event.detail);
      } else {
        await contactsStore.createContact(event.detail);
      }
      await goto('/dashboard/contacts');
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="max-w-2xl">
  <h1 class="text-3xl font-bold mb-6">
    {contactId ? 'Edit Contact' : 'New Contact'}
  </h1>
  
  <ContactForm
    contact={$contactsStore.currentContact}
    {isLoading}
    on:submit={handleSubmit}
  />
</div>
```

---

## Error Handling

### Error Boundary Component

```svelte
<!-- lib/components/common/ErrorBoundary.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  let error: Error | null = null;
  
  onMount(() => {
    const handleError = (event: ErrorEvent) => {
      error = event.error;
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      error = new Error(event.reason);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  });
</script>

{#if error}
  <Alert type="error">
    <h3 class="font-bold">Something went wrong</h3>
    <p>{error.message}</p>
    <Button on:click={() => location.reload()}>Reload Page</Button>
  </Alert>
{:else}
  <slot />
{/if}
```

### Error Handling Utilities

```typescript
// lib/utils/error.ts
import type { AxiosError } from 'axios';
import type { ErrorResponse } from '$lib/api/types';

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ErrorResponse;
    return data?.message || error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

export function logError(error: unknown, context?: string): void {
  console.error(`[${context}]`, error);
  // Send to error tracking service (Sentry, etc.)
}
```

### Toast Notifications

```typescript
// lib/stores/ui.store.ts
import { writable } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

export const uiStore = writable<UIState>({
  notifications: [],
  // ...
});

export function notify(
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration: number = 5000,
) {
  const id = uuidv4();
  
  uiStore.update(state => ({
    ...state,
    notifications: [
      ...state.notifications,
      { id, message, type, duration },
    ],
  }));
  
  if (duration > 0) {
    setTimeout(() => closeNotification(id), duration);
  }
}

export function closeNotification(id: string) {
  uiStore.update(state => ({
    ...state,
    notifications: state.notifications.filter(n => n.id !== id),
  }));
}
```

---

## Performance & Optimization

### Lazy Loading

```svelte
<!-- lib/components/common/LazyImage.svelte -->
<script lang="ts">
  export let src: string;
  export let alt: string;
  
  let loaded = false;
</script>

{#if loaded}
  <img {src} {alt} class="w-full h-auto" />
{:else}
  <div class="bg-gray-200 aspect-square animate-pulse" />
  <img
    {src}
    {alt}
    on:load={() => (loaded = true)}
    style="display: none"
  />
{/if}
```

### Code Splitting

```typescript
// lib/routes.ts
export const routes = {
  dashboard: () => import('./routes/dashboard/+page.svelte'),
  contacts: () => import('./routes/dashboard/contacts/+page.svelte'),
  contact: () => import('./routes/dashboard/contacts/[id]/+page.svelte'),
};
```

### Virtual Scrolling (for large lists)

```svelte
<!-- lib/components/contacts/VirtualContactList.svelte -->
<script lang="ts">
  import { VirtualScroll } from 'virtual-scroller';
  
  export let contacts: Contact[];
</script>

<VirtualScroll let:item={contact}>
  <ContactCard {contact} />
</VirtualScroll>
```

### Caching Strategy

```typescript
// lib/utils/cache.ts
export class Cache<T> {
  private data: Map<string, { value: T; timestamp: number }> = new Map();
  private ttl: number;
  
  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
  }
  
  get(key: string): T | null {
    const item = this.data.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.data.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  set(key: string, value: T): void {
    this.data.set(key, { value, timestamp: Date.now() });
  }
  
  clear(): void {
    this.data.clear();
  }
}

export const contactCache = new Cache<Contact>(5 * 60); // 5 minutes
```

### Image Optimization

```typescript
// lib/utils/images.ts
export function getOptimizedImageUrl(url: string, width: number, height: number): string {
  // Use a service like Cloudinary or imgix
  return `${url}?w=${width}&h=${height}&fit=crop`;
}
```

### Bundle Analysis

```bash
# Add to package.json scripts
"analyze": "vite-plugin-visualizer"

# Run
bun run analyze
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/stores.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authStore, login, logout } from '$lib/stores/auth.store';
import { get } from 'svelte/store';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state
  });
  
  it('should login successfully', async () => {
    await login('tenant-a', 'user', 'pass');
    const state = get(authStore);
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBeDefined();
  });
  
  it('should handle login error', async () => {
    const error = new Error('Invalid credentials');
    // Mock authService to throw
    expect(async () => {
      await login('tenant-a', 'user', 'wrong');
    }).rejects.toThrow();
  });
});
```

### Integration Tests

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import LoginForm from '$lib/components/forms/LoginForm.svelte';

describe('Login Flow', () => {
  it('should submit login form with valid data', async () => {
    const { component } = render(LoginForm);
    
    const usernameInput = screen.getByPlaceholderText('Username');
    const submitButton = screen.getByText('Sign In');
    
    // Fill form and submit
    // Assert success
  });
});
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/flows.test.ts
import { test, expect } from '@playwright/test';

test('complete contact management flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="text"]', 'user@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // Create contact
  await page.click('text=Add Contact');
  await page.fill('input[name="firstName"]', 'John');
  await page.fill('input[name="lastName"]', 'Doe');
  await page.click('button[type="submit"]');
  
  // Verify contact appears in list
  await expect(page.locator('text=John Doe')).toBeVisible();
});
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { getViteConfig } from 'astro/config';

export default defineConfig({
  ...getViteConfig(),
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
      ],
    },
  },
});
```

---

## Security Considerations

### Input Validation

```typescript
// lib/utils/validation.ts
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(8),
  tenant: z.string().regex(/^[a-z0-9_-]{1,64}$/),
});

export const contactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\d{10,15}$/).optional(),
  address: z.string().max(500).optional(),
  metadata: z.record(z.string()).optional(),
});
```

### XSS Prevention

```svelte
<!-- Svelte automatically escapes by default -->
<p>{userInput}</p> <!-- Safe -->

<!-- Use {@html} sparingly and only with trusted content -->
{#if trustedHtml}
  {@html trustedHtml}
{/if}
```

### CSRF Protection

```typescript
// Handled by axios with withCredentials
apiClient.defaults.withCredentials = true;

// Server should validate CSRF tokens in cookies
```

### Secure Storage

```typescript
// Never store sensitive data in localStorage
// Use in-memory storage for tokens
export const authStore = writable<AuthState>({
  token: null, // In-memory only
  // refreshToken stored in HttpOnly cookie by server
});
```

### Content Security Policy

```html
<!-- public/index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' api.example.com;
">
```

### Environment Variables

```bash
# .env.example
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Effinsty
VITE_LOG_LEVEL=info

# .env.production
VITE_API_URL=https://api.example.com
VITE_LOG_LEVEL=error
```

---

## Accessibility & Internationalization

### Accessibility (A11y)

```svelte
<!-- lib/components/common/Button.svelte -->
<button
  aria-label={ariaLabel}
  aria-pressed={isPressed}
  aria-disabled={disabled}
  role="button"
>
  <slot />
</button>

<!-- Keyboard navigation -->
<div on:keydown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    handleAction();
  }
}}>
```

### ARIA Labels

```svelte
<!-- lib/components/forms/LoginForm.svelte -->
<form aria-label="Login form">
  <label for="username">Username</label>
  <input
    id="username"
    type="text"
    aria-required="true"
    aria-invalid={error ? 'true' : 'false'}
  />
</form>
```

### Screen Reader Support

```typescript
// lib/utils/a11y.ts
export function announceMessage(message: string, polite: boolean = true): void {
  const ariaLive = document.createElement('div');
  ariaLive.setAttribute('aria-live', polite ? 'polite' : 'assertive');
  ariaLive.setAttribute('aria-atomic', 'true');
  ariaLive.className = 'sr-only';
  ariaLive.textContent = message;
  document.body.appendChild(ariaLive);
  
  setTimeout(() => ariaLive.remove(), 1000);
}
```

### Internationalization (i18n)

```typescript
// lib/i18n/messages.ts
export const messages = {
  en: {
    'nav.contacts': 'Contacts',
    'nav.settings': 'Settings',
    'button.add': 'Add',
    'button.delete': 'Delete',
    'errors.notFound': 'Not found',
  },
  es: {
    'nav.contacts': 'Contactos',
    'nav.settings': 'Configuración',
    'button.add': 'Añadir',
    'button.delete': 'Eliminar',
    'errors.notFound': 'No encontrado',
  },
};
```

```typescript
// lib/stores/i18n.store.ts
export const locale = writable<'en' | 'es'>('en');

export const t = (key: string) => {
  const currentLocale = get(locale);
  return messages[currentLocale][key as keyof typeof messages.en] || key;
};
```

---

## Development Workflow

### Setup Instructions

```bash
# Prerequisites
# - Node.js 20+ or Bun 1.0+
# - Git

# Clone repository
git clone <repository-url>
cd effinsty-frontend

# Install dependencies with Bun
bun install

# Copy environment file
cp .env.example .env.local

# Start development server
bun run dev

# Open browser
open http://localhost:5173
```

### Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "svelte-check && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "lint": "eslint src tests",
    "format": "prettier --write \"src/**/*.{ts,svelte,json}\"",
    "type-check": "svelte-check",
    "analyze": "vite-plugin-visualizer",
    "clean": "rm -rf dist node_modules .svelte-kit"
  }
}
```

### Git Workflow

```bash
# Feature branches
git checkout -b feature/add-contact-filters

# Commit messages
git commit -m "feat: add search and filter to contacts list"

# Types: feat, fix, docs, style, refactor, perf, test, chore

# Push and create PR
git push origin feature/add-contact-filters
```

### Code Style

```typescript
// ESLint configuration
module.exports = {
  extends: ['eslint:recommended', 'plugin:svelte/recommended'],
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error',
  },
};

// Prettier configuration
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## Deployment

### Build Process

```bash
# Type checking
svelte-check

# Production build
bun run build

# Output
# dist/
#   ├── index.html
#   ├── assets/
#   │   ├── index-abc123.js
#   │   └── index-def456.css
#   └── ...
```

### Environment Configuration

```bash
# Development
VITE_API_URL=http://localhost:5000/api
VITE_LOG_LEVEL=debug

# Staging
VITE_API_URL=https://api-staging.example.com
VITE_LOG_LEVEL=info

# Production
VITE_API_URL=https://api.example.com
VITE_LOG_LEVEL=error
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install
COPY . .
RUN bun run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - '3000:3000'
    environment:
      VITE_API_URL: http://api:5000/api
    depends_on:
      - api

  api:
    image: effinsty-api:latest
    ports:
      - '5000:5000'
    environment:
      ASPNETCORE_ENVIRONMENT: Development
```

### Deployment Checklist

- [ ] All tests passing
- [ ] Linting and type checking completed
- [ ] Environment variables set correctly
- [ ] Performance audit passed
- [ ] Security audit passed
- [ ] Build completes without warnings
- [ ] Bundle size analyzed
- [ ] Assets cached appropriately
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (Google Analytics)
- [ ] SEO metadata configured
- [ ] Favicon and manifest generated
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] CSP headers set

---

## Monitoring & Analytics

### Error Tracking (Sentry)

```typescript
// lib/utils/sentry.ts
import * as Sentry from "@sentry/svelte";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
```

### Analytics

```typescript
// lib/utils/analytics.ts
export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (window.gtag) {
    gtag('event', name, properties);
  }
}

export function trackPageView(path: string) {
  trackEvent('page_view', { page_path: path });
}
```

### Logging

```typescript
// lib/utils/logger.ts
export class Logger {
  static debug(message: string, data?: unknown) {
    if (import.meta.env.DEV) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  static info(message: string, data?: unknown) {
    console.info(`[INFO] ${message}`, data);
  }

  static warn(message: string, data?: unknown) {
    console.warn(`[WARN] ${message}`, data);
  }

  static error(message: string, error?: unknown) {
    console.error(`[ERROR] ${message}`, error);
    // Send to Sentry
    if (import.meta.env.PROD) {
      Sentry.captureException(error);
    }
  }
}
```

### Performance Monitoring

```typescript
// lib/utils/performance.ts
export function measurePerformance(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;

      Logger.info(`[${name}] completed in ${duration.toFixed(2)}ms`);
      
      if (window.gtag) {
        gtag('event', 'timing_complete', {
          name,
          duration: Math.round(duration),
        });
      }

      return result;
    };

    return descriptor;
  };
}
```

### Health Check

```typescript
// lib/api/health.ts
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await apiClient.get('/health');
    return response.status === 200;
  } catch {
    return false;
  }
}

// In header component
onMount(() => {
  setInterval(async () => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
      notify('API connection lost', 'error');
    }
  }, 30000);
});
```

---

## Appendices

### A. Dependencies Details

**Core Framework:**
- `svelte@5.0.0+` - UI framework
- `vite@5.0.0+` - Build tool
- `typescript@5.3.0+` - Type safety

**HTTP & State:**
- `axios@1.6.0+` - HTTP client
- `StackExchange.Redis` - Session storage (server-side)

**Validation & Data:**
- `zod@3.22.0+` - Schema validation

**UI & Styling:**
- `tailwindcss@3.4.0+` - CSS framework
- `lucide-svelte@0.292.0+` - Icon library
- `clsx@2.0.0+` - Conditional CSS classes

**Testing:**
- `vitest@1.0.0+` - Unit tests
- `@playwright/test@1.0.0+` - E2E tests

### B. Environment Variables

```bash
# API Configuration
VITE_API_URL=http://localhost:5000/api
VITE_API_TIMEOUT=10000

# App Configuration
VITE_APP_NAME=Effinsty
VITE_APP_VERSION=1.0.0
VITE_LOG_LEVEL=info

# External Services
VITE_SENTRY_DSN=
VITE_GA_ID=
VITE_MIXPANEL_TOKEN=

# Feature Flags
VITE_ENABLE_OFFLINE_MODE=false
VITE_ENABLE_ANALYTICS=true
```

### C. Type Definitions

Ensure all API responses match backend definitions exactly.

### D. Component Library

Maintain a living component library with Storybook:

```bash
bun add -D @storybook/svelte
npx sb init --type svelte
```

### E. CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun run test
      - run: bun run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=dist
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-12 | System | Initial specification |

---

**End of Document**