import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { OnApproveData } from "@paypal/paypal-js";

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private _session = new BehaviorSubject<Session | null>(null);
  readonly session$ = this._session.asObservable();

  // Stocker le rôle de l'utilisateur
  private _isAdmin = new BehaviorSubject<boolean>(false);
  readonly isAdmin$ = this._isAdmin.asObservable();

  constructor() {
    this.supabase = createClient(
      (environment as any).supabaseUrl,
      (environment as any).supabaseKey
    );

    // Écouter les changements d'auth
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this._session.next(session);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this._session.next(session);
      if (session?.user) {
        // await this.loadUserProfile(session.user.id);
        this.loadUserProfile(session.user.id);
      } else {
        this._isAdmin.next(false);
      }
    });
  }

  // Récupérer le rôle dans la table 'profiles'
  private async loadUserProfile(userId: string) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (error) {
        return;
      }
      if (data && data.role === 'admin') {
        this._isAdmin.next(true);
      } else {
        this._isAdmin.next(false);
      }
    } catch (err) {
      this._isAdmin.next(false);
    }
  }

  get isAdmin(): boolean {
    return this._isAdmin.value;
  }

  get user() {
    return this.supabase.auth.getUser();
  }

  signIn(email: string) {
    return this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: (environment as any).supabaseRedirectUrl
      }
    });
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  getDocuments(theme?: string, category?: string) {
    // let query = this.supabase.from('documents').select('*');
    //
    // if (theme) {
    //   query = query.eq('theme', theme);
    // }
    //
    // if (category) {
    //   query = query.eq('categorie', category);
    // }
    //
    // return query.order('annee', { ascending: false });

    return this.supabase.rpc(
      'get_documents_limited',
      { p_theme: theme, ...(category && { p_categorie: category }) }
    );
  }

  addDocument(document: { theme: string; categorie: string; nom: string; annee: number; numero: string; lien?: string }) {
    return this.supabase
      .from('documents')
      .insert([document]);
  }

  getThemes() {
    // return this.supabase
    //   .from('distinct_themes')
    //   .select('theme')
    //   .order('theme', { ascending: true });
    return this.supabase.rpc('get_themes');
  }

  getCategoriesByTheme(theme: string) {
    // return this.supabase
    //   .from('distinct_categories')
    //   .select('categorie')
    //   .eq('theme', theme)
    //   .order('categorie', { ascending: true });
    return this.supabase.rpc('get_categories', { p_theme: theme });
  }

  async helloWorld(amount: number) {
    return await this.supabase.functions.invoke('hello-world', {
      body: {
        "intent": "CAPTURE",
        "purchase_units": [
          {
            "amount": { "currency_code": "EUR", "value": amount }
          }
        ]
      },
    });
  }

  async approvedPayment(approvedData: OnApproveData) {
    return await this.supabase.functions.invoke('paypal-onapprove', {
      body: approvedData,
    });
  }
}
