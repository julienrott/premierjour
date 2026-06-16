import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Session } from '@supabase/supabase-js';
import { loadScript } from "@paypal/paypal-js";
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  documents: any[] = [];
  themes: string[] = [];
  categories: string[] = [];

  selectedTheme: string = '';
  selectedCategory: string = '';

  isLoading: boolean = false;
  session: Session | null = null;
  email: string = '';
  authLoading: boolean = false;
  messageSent: boolean = false;
  private supabaseService = inject(SupabaseService);
  donAmount: number | undefined = undefined;
  paypalRendered = false;
  isAdmin$ = this.supabaseService.isAdmin$;

  showAddPage: boolean = false;
  newDocTheme: string = '';
  newDocCategory: string = '';
  newDocNom: string = '';
  newDocAnnee: number | null = null;
  newDocNumero: string = '';
  newDocLien: string = '';

  @ViewChild('paypalContainer') set paypalContainer(content: ElementRef) {
    if (content) {
      if (!this.paypalRendered) {
        this.paypalRendered = true;
        this.loadPayPal(content.nativeElement);
      }
    } else {
      this.paypalRendered = false;
    }
  }

  constructor() { }

  async ngOnInit() {
    this.supabaseService.session$.subscribe(session => {
      this.session = session;
      if (session) {
        this.loadThemes();
      }
    });
  }

  async login() {
    if (!this.email) return;

    this.authLoading = true;
    const { error } = await this.supabaseService.signIn(this.email);
    this.authLoading = false;

    if (error) {
      console.error('Erreur login:', error.message);
      alert('Erreur: ' + error.message);
    } else {
      this.messageSent = true;
    }
  }

  async logout() {
    await this.supabaseService.signOut();
    this.session = null;
    this.messageSent = false;
    this.email = '';
    this.documents = [];
    this.selectedTheme = '';
  }

  async loadThemes() {
    const { data, error } = await this.supabaseService.getThemes();
    if (error) {
      console.error('Error fetching themes:', error);
    } else {
      this.themes = data.map((d: any) => d.theme).filter(Boolean);
    }
  }

  async loadCategories() {
    if (!this.selectedTheme) {
      this.categories = [];
      return;
    }
    const { data, error } = await this.supabaseService.getCategoriesByTheme(this.selectedTheme);
    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      this.categories = data.map((d: any) => d.categorie).filter(Boolean);
    }
  }

  async loadDocuments() {
    if (!this.selectedTheme) {
      this.documents = [];
      return;
    }

    this.isLoading = true;
    try {
      const { data, error } = await this.supabaseService.getDocuments(this.selectedTheme, this.selectedCategory);
      if (error) {
        console.error('Error fetching documents:', error);
      } else {
        this.documents = data || [];
      }
    } finally {
      this.isLoading = false;
    }
  }

  async onThemeChange() {
    this.selectedCategory = '';
    await Promise.all([
      this.loadCategories()
    ]);
  }

  async onCategoryChange() {
    if (!this.selectedCategory) {
      this.documents = [];
      return;
    }
    await this.loadDocuments();
  }

  async loadPayPal(element: HTMLElement) {
    const paypal = await loadScript({
      "clientId": environment.paypalClientId,
      "currency": "EUR",
      "environment": environment.paypalEnvironment as "production" | "sandbox"
    });
    if (!paypal)
      return;
    if (!paypal.Buttons)
      return;
    if (!paypal.FUNDING)
      return;
    if (!this.paypalRendered)
      return;

    await paypal.Buttons({
      fundingSource: paypal.FUNDING["PAYPAL"],
      createOrder: async () => {
        if (this.donAmount == undefined || this.donAmount < 1) {
          throw new Error("Entrez un montant supérieur à zéro.");
        }
        const { data, error } = await this.supabaseService.helloWorld(this.donAmount);
        if (error) {
          throw error;
        }
        return data.paypal.id;
      },
      onApprove: async (approvedData) => {
        const { data, error } = await this.supabaseService.approvedPayment(approvedData);
        if (error) {
          throw error;
        }
        alert("Merci pour votre don");
        window.location.reload();
      },
      onCancel: async (error) => {
        alert("Le paiement a été annulé");
      },
      onError: async (error) => {
        alert(error);
      }
    }).render(element);
  }

  navigateToAdd() {
    this.showAddPage = true;
  }

  cancelAdd() {
    this.showAddPage = false;
    this.resetAddForm();
  }

  async saveDocument() {
    if (!this.newDocTheme || !this.newDocCategory || !this.newDocNom || !this.newDocAnnee || !this.newDocNumero) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const doc = {
      theme: this.newDocTheme,
      categorie: this.newDocCategory,
      nom: this.newDocNom,
      annee: this.newDocAnnee,
      numero: this.newDocNumero,
      ...(this.newDocLien && { lien: this.newDocLien }),
    };

    const { error } = await this.supabaseService.addDocument(doc);
    if (error) {
      console.error('Erreur ajout document:', error);
      alert('Erreur: ' + error.message);
    } else {
      alert('Document ajouté avec succès !');
      this.showAddPage = false;
      this.resetAddForm();
      await this.loadDocuments();
    }
  }

  private resetAddForm() {
    this.newDocTheme = '';
    this.newDocCategory = '';
    this.newDocNom = '';
    this.newDocAnnee = null;
    this.newDocNumero = '';
    this.newDocLien = '';
  }

}
