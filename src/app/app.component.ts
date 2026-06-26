import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Session } from '@supabase/supabase-js';
import { loadScript } from "@paypal/paypal-js";
import { environment } from 'src/environments/environment';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

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

  searchQuery: string = '';
  searchSubject = new Subject<string>();

  isLoading: boolean = false;
  session: Session | null = null;
  email: string = '';
  authLoading: boolean = false;
  messageSent: boolean = false;
  private supabaseService = inject(SupabaseService);
  donAmount: number | undefined = undefined;
  paypalRendered = false;
  isAdmin$ = this.supabaseService.isAdmin$;

  paymentStatus: 'success' | 'error' | 'cancel' | null = null;
  paymentErrorMessage: string = '';

  showAddPage: boolean = false;
  newDocTheme: string = '';
  newDocCategory: string = '';
  newDocNom: string = '';
  newDocAnnee: number | null = null;
  newDocNumero: string = '';
  newDocLien: string = '';

  showEditPage: boolean = false;
  editDocId: number | null = null;
  editDocTheme: string = '';
  editDocCategory: string = '';
  editDocNom: string = '';
  editDocAnnee: number | null = null;
  editDocNumero: string = '';
  editDocLien: string = '';

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

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(async (query) => {
      if (!query || query.trim() === '') {
        this.selectedTheme = '';
        this.selectedCategory = '';
        this.categories = [];
        this.documents = [];
        return;
      }

      this.selectedTheme = '';
      this.selectedCategory = '';
      this.categories = [];

      this.isLoading = true;
      try {
        const { data, error } = await this.supabaseService.searchDocumentsByName(query);
        if (error) {
          console.error('Error searching documents:', error);
        } else {
          this.documents = data || [];
        }
      } finally {
        this.isLoading = false;
      }
    });
  }

  onSearchChange(event: any) {
    this.searchSubject.next(this.searchQuery);
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
        this.paymentStatus = 'success';
      },
      onCancel: async (error) => {
        this.paymentStatus = 'cancel';
      },
      onError: async (error) => {
        this.paymentStatus = 'error';
        this.paymentErrorMessage = String(error);
      }
    }).render(element);
  }

  returnFromPayment() {
    this.paymentStatus = null;
    this.paymentErrorMessage = '';
    this.donAmount = undefined;
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
      annee: Number(this.newDocAnnee),
      numero: String(this.newDocNumero),
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

  startEdit(document: any) {
    this.editDocId = document.id;
    this.editDocTheme = document.theme || '';
    this.editDocCategory = document.categorie || '';
    this.editDocNom = document.nom || '';
    this.editDocAnnee = document.annee || null;
    this.editDocNumero = document.numero || '';
    this.editDocLien = document.lien || '';
    this.showEditPage = true;
  }

  cancelEdit() {
    this.showEditPage = false;
    this.resetEditForm();
  }

  async updateDocument() {
    if (!this.editDocId || !this.editDocTheme || !this.editDocCategory || !this.editDocNom || !this.editDocAnnee || !this.editDocNumero) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const doc = {
      theme: this.editDocTheme,
      categorie: this.editDocCategory,
      nom: this.editDocNom,
      annee: Number(this.editDocAnnee),
      numero: String(this.editDocNumero),
      ...(this.editDocLien ? { lien: this.editDocLien } : { lien: null }),
    };

    const { error } = await this.supabaseService.updateDocument(this.editDocId, doc as any);
    if (error) {
      console.error('Erreur modification document:', error);
      alert('Erreur: ' + error.message);
    } else {
      alert('Document modifié avec succès !');
      this.showEditPage = false;
      this.resetEditForm();
      await this.loadDocuments();
    }
  }

  private resetEditForm() {
    this.editDocId = null;
    this.editDocTheme = '';
    this.editDocCategory = '';
    this.editDocNom = '';
    this.editDocAnnee = null;
    this.editDocNumero = '';
    this.editDocLien = '';
  }

}
