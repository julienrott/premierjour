# Architecture Supabase-Ionic-App

## 🏗️ Stack Technique

```
Frontend: Ionic Angular 20 + Capacitor 8
Backend: Supabase (PostgreSQL + Auth + Edge Functions)
Paiements: PayPal JS SDK
```

## 📁 Structure

```
src/
├── app/
│   ├── app.component.ts      # Composant principal (UI + logique métier)
│   ├── app.component.html    # Template unique
│   ├── app.module.ts         # Module Angular de base
│   └── supabase.service.ts   # Service singleton (toutes les requêtes)
├── environments/
│   ├── environment.ts        # Config DEV (URLs, clés)
│   └── environment.template.ts
└── main.ts                  # Bootstrap Angular
```

---

## 🔄 Architecture & Data Flow

### Auth Flow
```
app.component.ts → SupabaseService.signIn(email)
  → supabase.auth.signInWithOtp()
  → onAuthStateChange() → BehaviorSubject<Session>
  → loadUserProfile() → profiles.role → BehaviorSubject<boolean> (isAdmin$)
```

### Data Flow
```
UI (app.component) → SupabaseService
  → supabase.rpc() (stored procedures)
    ├── get_documents_limited(theme, categorie)
    ├── get_themes()
    └── get_categories(p_theme)
  → CRUD sur table 'documents'
```

### Payment Flow
```
PayPal Button → createOrder()
  → SupabaseService.helloWorld(amount)
  → supabase.functions.invoke('hello-world')
  → Retourne paypalOrderId

onApprove()
  → SupabaseService.approvedPayment(approvedData)
  → supabase.functions.invoke('paypal-onapprove')
```

---

## 🔐 Sécurité

| Élément | Implémentation |
|---------|----------------|
| Auth | OTP email via Supabase Auth |
| Rôles | Table `profiles` avec champ `role` (`admin`/`user`) |
| Sessions | BehaviorSubject + onAuthStateChange |
| Clés | Dans `environment.ts` (exclu du git via template) |

**⚠️ Attention**: `supabaseKey` est une **publishable key** (front-safe). La **secret key** doit rester côté serveur (Edge Functions).

---

## 🗄️ Schéma Supabase

### Tables
```sql
-- profiles
id (uuid, pk, fk:auth.users.id) | role (text: 'admin'/'user')

-- documents
id (serial, pk) | theme | categorie | nom | annee | numero | lien

-- dons
id (uuid, pk) | user_id (uuid, fk:auth.users.id) | amount (numeric) | currency (text, default:'EUR') | status (text, default:'pending') | payment_id (text) | payment_source (text) | payer_id (text) | order_id (text) | payer_email (text) | payer_name (text) | message (text) | created_at (timestamptz, default:now())
```

### Stored Procedures
```sql
get_documents_limited(p_theme, p_categorie) → documents filtrés
get_themes() → thèmes distincts
get_categories(p_theme) → catégories par thème
```

### Edge Functions
```
hello-world     → Crée un ordre PayPal (POST /functions/v1/hello-world)
paypal-onapprove → Confirme le paiement (POST /functions/v1/paypal-onapprove)
```

---

## 🎯 Points Clés pour Agents IA

### 🔹 Optimisation Tokens
- **Contexte prioritaire**: `supabase.service.ts` (toutes les requêtes API)
- **Fichiers critiques**: `app.component.ts`, `environment.ts`
- **À ignorer**: `www/` (build), `node_modules/`, `.angular/`
- **Pas de politesse**: pas d'introduction ni de résumé du travail effectué, seulement le strict code nécessaire et les explications nécessaires.
- **Langue**: Français

### 🔹 Patterns à Réutiliser
```typescript
// Requête Supabase typique
const { data, error } = await this.supabase
  .from('table')
  .select('*')
  .eq('column', value);

// RPC (stored procedure)
const { data, error } = await this.supabase
  .rpc('function_name', { param: value });

// Edge Function
const { data, error } = await this.supabase
  .functions.invoke('function-name', { body: {...} });
```

### 🔹 Variables d'Environnement
```typescript
// environment.ts (DEV)
supabaseUrl: string
supabaseKey: string  // publishable key ONLY
supabaseRedirectUrl: string
paypalClientId: string
paypalEnvironment: 'sandbox' | 'production'
```

---

## 🚀 Commandes Utiles

| Commande | Description |
|----------|-------------|
| `npm start` | Lance le serveur dev (`ng serve`) |
| `npm run build` | Build Angular (`ng build`) |
| `npx cap sync` | Sync Capacitor |
| `npx cap add android/ios` | Ajoute une plateforme mobile |
| `npx cap copy` | Copie les assets web |
| `npx cap open android/ios` | Ouvre dans Android Studio/Xcode |

---

## 📋 Checklist Déploiement

- [ ] Remplir `environment.template.ts` → `environment.prod.ts`
- [ ] Vérifier `supabaseRedirectUrl` correspond à l'URL de prod
- [ ] Configurer CORS dans Supabase Dashboard
- [ ] Déployer Edge Functions (`supabase functions deploy`)
- [ ] Builder l'app (`npm run build`)
- [ ] Déployer le build (`www/`) sur un hébergeur statique
- [ ] OU: Builder pour mobile (`npx cap sync` + `npx cap copy`)

---

## 🔍 Débogage

### Supabase
```typescript
// Activer le logging
this.supabase = createClient(url, key, {
  db: { schema: 'public' },
  auth: { debug: true },
  global: { headers: { 'x-my-header': 'value' } }
});
```

### Common Issues
| Erreur | Solution |
|--------|----------|
| `403 Forbidden` (RPC) | Vérifier les **RLS** dans Supabase |
| `JWT expired` | Rafraîchir la session (`signOut()` → `signIn()`) |
| PayPal `createOrder` échoue | Vérifier `paypalClientId` et `paypalEnvironment` |
| CORS error | Configurer CORS dans Supabase Dashboard |

---

## 📊 Diagramme d'Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Ionic Angular)                    │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │  app.component   │───▶│ supabase.service │───▶│  Supabase   │  │
│  │  (UI + Logique)  │    │  (Singleton)     │    │  Client    │  │
│  └─────────────────┘    └─────────────────┘    └────────────┘  │
│                           │                                  │
│                           ├──▶ Auth (OTP Email)               │
│                           ├──▶ PostgreSQL (RPC)              │
│                           ├──▶ Edge Functions (PayPal)       │
│                           └──▶ Storage (si futur usage)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Supabase)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Auth      │  │ PostgreSQL  │  │      Edge Functions       │ │
│  │ (JWT/OAuth) │  │ (RLS activé)│  │ (Deno/TypeScript)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│           │                 │                     │            │
│           └─────────────────┼─────────────────────┘            │
│                             ▼                                  │
│                    ┌─────────────────┐                         │
│                    │   PayPal API     │                         │
│                    │   (Sandbox/Prod) │                         │
│                    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Résumé pour Techlead

**C'est une app monotithique** (1 composant Angular) avec:
- **Backend-as-a-Service**: Supabase gère Auth + DB + Functions
- **Paiements**: PayPal SDK intégré côté client (Edge Functions comme proxy)
- **Mobile-ready**: Capacitor pour build Android/iOS
- **État global**: BehaviorSubject (RxJS) pour session et rôles

**Améliorations possibles**:
1. Découper `app.component.ts` en plusieurs composants
2. Ajouter des interfaces TypeScript pour `Document`
3. Implémenter des guards Angular pour les routes admin
4. Externaliser PayPal dans un service dédié
5. Ajouter des tests unitaires pour `SupabaseService`

**Tokens économisés**: Ce fichier permet aux agents IA de cibler directement les fichiers pertinents sans explorer tout le projet.
