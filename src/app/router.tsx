import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthPage } from '@/features/auth/components/AuthPage'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { OrgGate } from '@/features/organization/components/OrgGate'
import { AppLayout } from './AppLayout'
import { HomePage } from './HomePage'

export const router = createBrowserRouter([
  { path: '/connexion', element: <AuthPage key="login" mode="login" /> },
  { path: '/inscription', element: <AuthPage key="signup" mode="signup" /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/demarrer',
        lazy: async () => ({ Component: (await import('@/features/organization/components/CreateOrganizationPage')).CreateOrganizationPage }),
      },
      {
        element: <OrgGate />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              {
                path: 'produits',
                children: [
                  { index: true, lazy: async () => ({ Component: (await import('@/features/products/components/ProductsPage')).ProductsPage }) },
                  { path: 'nouveau', lazy: async () => ({ Component: (await import('@/features/products/components/ProductFormPage')).ProductFormPage }) },
                  { path: 'categories', lazy: async () => ({ Component: (await import('@/features/products/components/CategoriesPage')).CategoriesPage }) },
                  { path: 'import', lazy: async () => ({ Component: (await import('@/features/products/components/ImportPage')).ImportPage }) },
                  { path: ':id', lazy: async () => ({ Component: (await import('@/features/products/components/ProductFormPage')).ProductFormPage }) },
                ],
              },
              // Pages peu utilisées : chargées à la demande pour alléger le démarrage sur mobile.
              {
                path: 'parametres',
                lazy: async () => ({ Component: (await import('@/features/settings/components/SettingsPage')).SettingsPage }),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
