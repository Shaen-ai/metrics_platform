import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useState, useEffect } from "react";
import {
  User,
  Mode,
  CatalogItem,
  Material,
  MaterialTemplate,
  Module,
  Order,
  LoginCredentials,
  SignupData,
} from "./types";
import { api } from "./api";
import { normalizeLanguageCode } from "./translations";

function normalizeUserFromApi(user: User): User {
  return {
    ...user,
    language: normalizeLanguageCode(user.language),
  };
}

/** Laravel returns `{ data: T[] }`; tolerate an accidental extra `data` wrapper. */
function normalizeListResponse<T>(res: { data?: unknown }): T[] {
  const outer = res?.data;
  if (Array.isArray(outer)) return outer as T[];
  if (outer && typeof outer === "object" && "data" in outer) {
    const inner = (outer as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

/** API returns connection points as `{ position, type }[]`; admin UI uses boolean map. */
function normalizeModuleConnectionPoints(
  raw: Module["connectionPoints"] | Array<{ position?: string }> | undefined,
): Module["connectionPoints"] {
  const out: Module["connectionPoints"] = {
    top: false,
    bottom: false,
    left: false,
    right: false,
  };
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      const p = row?.position;
      if (p === "top") out.top = true;
      else if (p === "bottom") out.bottom = true;
      else if (p === "left") out.left = true;
      else if (p === "right") out.right = true;
    }
    return out;
  }
  return {
    top: !!raw.top,
    bottom: !!raw.bottom,
    left: !!raw.left,
    right: !!raw.right,
  };
}

/**
 * Merge resource shape + snake_case fallbacks. Fixes list/edit when API omits or differs on fields.
 */
function normalizeModuleFromApi(raw: unknown): Module {
  const m = raw as Record<string, unknown> & Partial<Module>;
  const modelUrl =
    (m.modelUrl as string | undefined) ??
    (m.model_url as string | undefined) ??
    undefined;
  const modelStatus =
    (m.modelStatus as Module["modelStatus"] | undefined) ??
    (m.model_status as Module["modelStatus"] | undefined) ??
    undefined;
  const modelJobId =
    (m.modelJobId as string | undefined) ??
    (m.model_job_id as string | undefined) ??
    undefined;
  const modelError =
    (m.modelError as string | undefined) ??
    (m.model_error as string | undefined) ??
    undefined;
  return {
    ...(m as unknown as Module),
    modelUrl: modelUrl || undefined,
    modelStatus: modelStatus || undefined,
    modelJobId: modelJobId || undefined,
    modelError: modelError || undefined,
    connectionPoints: normalizeModuleConnectionPoints(
      m.connectionPoints as
        | Module["connectionPoints"]
        | Array<{ position?: string }>
        | undefined,
    ),
    images: Array.isArray(m.images) ? (m.images as string[]) : [],
    compatibleWith: Array.isArray(m.compatibleWith) ? (m.compatibleWith as string[]) : [],
  };
}

let materialsFetchPromise: Promise<void> | null = null;

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  loading: boolean;

  // Data
  modes: Mode[];
  catalogItems: CatalogItem[];
  materials: Material[];
  materialTemplates: MaterialTemplate[];
  modules: Module[];
  orders: Order[];

  // Auth actions
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{
    success: boolean;
    error?: string;
    needsEmailVerification?: boolean;
  }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (data: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;

  // Mode actions
  selectMode: (modeId: string, subModeIds: string[]) => Promise<void>;
  fetchModes: () => Promise<void>;
  getModeById: (modeId: string) => Mode | undefined;
  getSubModeById: (modeId: string, subModeId: string) => Mode["subModes"][0] | undefined;
  getSubModesByIds: (modeId: string, subModeIds: string[]) => Mode["subModes"];

  // Catalog actions
  fetchCatalogItems: () => Promise<void>;
  addCatalogItem: (item: Omit<CatalogItem, "id" | "adminId" | "createdAt">) => Promise<CatalogItem>;
  updateCatalogItem: (id: string, updates: Partial<CatalogItem>) => Promise<void>;
  deleteCatalogItem: (id: string) => Promise<void>;

  // Material actions
  fetchMaterials: () => Promise<void>;
  fetchMaterialTemplates: (params?: {
    manufacturer?: string;
    search?: string;
    type?: string;
  }) => Promise<void>;
  importMaterialTemplates: (payload: {
    templateIds: string[];
    modeId: string;
    subModeId?: string | null;
    pricePerUnit: number;
    currency: string;
    categories?: string[];
  }) => Promise<Material[]>;
  bulkUpdateMaterials: (payload: {
    ids: string[];
    pricePerUnit: number;
    price?: number;
    currency?: string;
  }) => Promise<void>;
  addMaterial: (material: Omit<Material, "id" | "adminId">) => Promise<Material>;
  updateMaterial: (id: string, updates: Partial<Material>) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;

  // Module actions
  fetchModules: () => Promise<void>;
  addModule: (module: Omit<Module, "id" | "adminId">) => Promise<Module>;
  updateModule: (id: string, updates: Partial<Module>) => Promise<void>;
  deleteModule: (id: string) => Promise<void>;

  // Order actions
  fetchOrders: () => Promise<void>;
  addOrder: (order: Omit<Order, "id" | "createdAt">) => Promise<Order>;
  updateOrderStatus: (id: string, status: Order["status"], notes?: string) => Promise<void>;

  // Public data
  getAdminBySlug: (slug: string) => Promise<User | undefined>;
  getPublicCatalog: (adminId: string) => Promise<CatalogItem[]>;
  getPublicMaterials: (adminId: string) => Promise<Material[]>;
  getPublicModules: (adminId: string) => Promise<Module[]>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      loading: false,
      modes: [],
      catalogItems: [],
      materials: [],
      materialTemplates: [],
      modules: [],
      orders: [],

      // Auth
      login: async (credentials) => {
        try {
          const res = await api.login(credentials.email, credentials.password);
          const user = res.user as User;
          set({ currentUser: user, isAuthenticated: true });
          return { success: true };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Login failed";
          return { success: false, error: msg };
        }
      },

      signup: async (data) => {
        try {
          const res = await api.register({
            email: data.email,
            password: data.password,
            name: data.name,
            company_name: data.companyName,
          });
          if (res.token) {
            const user = normalizeUserFromApi(res.user as User);
            set({ currentUser: user, isAuthenticated: true });
            return { success: true, needsEmailVerification: false };
          }
          return { success: true, needsEmailVerification: true };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Signup failed";
          return { success: false, error: msg };
        }
      },

      forgotPassword: async (email) => {
        try {
          await api.forgotPassword(email);
          return { success: true };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Request failed";
          return { success: false, error: msg };
        }
      },

      resetPassword: async (payload) => {
        try {
          await api.resetPassword(payload);
          return { success: true };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Reset failed";
          return { success: false, error: msg };
        }
      },

      logout: async () => {
        try {
          await api.logout();
        } catch {
          // ignore
        }
        set({ currentUser: null, isAuthenticated: false, catalogItems: [], materials: [], modules: [], orders: [] });
      },

      restoreSession: async () => {
        if (!api.getToken()) {
          set({ isAuthenticated: false, currentUser: null });
          return;
        }
        try {
          const res = await api.getProfile();
          set({ currentUser: normalizeUserFromApi(res.user as User), isAuthenticated: true });
        } catch {
          api.setToken(null);
          set({ isAuthenticated: false, currentUser: null });
        }
      },

      refreshProfile: async () => {
        if (!api.getToken()) return;
        try {
          const res = await api.getProfile();
          set({ currentUser: normalizeUserFromApi(res.user as User), isAuthenticated: true });
        } catch {
          api.setToken(null);
          set({ currentUser: null, isAuthenticated: false });
        }
      },

      updateUser: async (updates) => {
        const payload: Record<string, unknown> = {};
        const snakeCaseUpdates = updates as Partial<User> & { paypal_email?: string };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.companyName !== undefined) payload.company_name = updates.companyName;
        if (updates.logo !== undefined) payload.logo = updates.logo;
        if (updates.language !== undefined) payload.language = updates.language;
        if (updates.currency !== undefined) payload.currency = updates.currency;
        if (updates.selectedModeId !== undefined) payload.selected_mode_id = updates.selectedModeId;
        if (updates.selectedSubModeIds !== undefined) payload.selected_sub_mode_ids = updates.selectedSubModeIds;
        if (updates.paypalEmail !== undefined) payload.paypal_email = updates.paypalEmail;
        if (snakeCaseUpdates.paypal_email !== undefined) payload.paypal_email = snakeCaseUpdates.paypal_email;
        if (updates.plannerMaterialIds !== undefined) payload.planner_material_ids = updates.plannerMaterialIds;
        if (updates.useCustomPlannerCatalog !== undefined) {
          payload.use_custom_planner_catalog = updates.useCustomPlannerCatalog;
        }
        if (updates.publicSiteLayout !== undefined) payload.public_site_layout = updates.publicSiteLayout;
        if (updates.publicSiteTexts !== undefined) payload.public_site_texts = updates.publicSiteTexts;
        if (updates.publicSiteTheme !== undefined) payload.public_site_theme = updates.publicSiteTheme;
        if (updates.customDesignKey !== undefined) payload.custom_design_key = updates.customDesignKey;

        const res = await api.updateProfile(payload);
        set({ currentUser: normalizeUserFromApi(res.user as User) });
      },

      // Modes
      selectMode: async (modeId, subModeIds) => {
        await get().updateUser({ selectedModeId: modeId, selectedSubModeIds: subModeIds } as Partial<User>);
      },

      fetchModes: async () => {
        const res = await api.getModes();
        set({ modes: res.data as Mode[] });
      },

      getModeById: (modeId) => get().modes.find((m) => m.id === modeId),

      getSubModeById: (modeId, subModeId) => {
        const mode = get().getModeById(modeId);
        return mode?.subModes.find((sm) => sm.id === subModeId);
      },

      getSubModesByIds: (modeId, subModeIds) => {
        const mode = get().getModeById(modeId);
        if (!mode) return [];
        const idSet = new Set(subModeIds);
        return mode.subModes.filter((sm) => idSet.has(sm.id));
      },

      // Catalog
      fetchCatalogItems: async () => {
        const res = await api.getCatalogItems();
        set({ catalogItems: res.data as CatalogItem[] });
      },

      addCatalogItem: async (item) => {
        const payload: Record<string, unknown> = {
          mode_id: item.modeId,
          sub_mode_id: item.subModeId,
          name: item.name,
          model: item.model || null,
          description: item.description,
          width: item.sizes.width,
          height: item.sizes.height,
          depth: item.sizes.depth,
          dimension_unit: item.sizes.unit,
          price: item.price,
          currency: item.currency,
          delivery_days: item.deliveryDays,
          category: item.category,
          is_active: item.isActive,
          images: item.images,
          colors: item.availableColors?.map((c) => ({ name: c.name, hex: c.hex })),
        };
        if (item.modelUrl) payload.model_url = item.modelUrl;
        if (item.modelStatus) payload.model_status = item.modelStatus;
        if (item.modelJobId) payload.model_job_id = item.modelJobId;
        const res = await api.createCatalogItem(payload);
        const newItem = res.data as CatalogItem;
        set((s) => ({ catalogItems: [newItem, ...s.catalogItems] }));
        return newItem;
      },

      updateCatalogItem: async (id, updates) => {
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.model !== undefined) payload.model = updates.model;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.modeId !== undefined) payload.mode_id = updates.modeId;
        if (updates.subModeId !== undefined) payload.sub_mode_id = updates.subModeId;
        if (updates.sizes) {
          payload.width = updates.sizes.width;
          payload.height = updates.sizes.height;
          payload.depth = updates.sizes.depth;
          payload.dimension_unit = updates.sizes.unit;
        }
        if (updates.price !== undefined) payload.price = updates.price;
        if (updates.currency !== undefined) payload.currency = updates.currency;
        if (updates.deliveryDays !== undefined) payload.delivery_days = updates.deliveryDays;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.images !== undefined) payload.images = updates.images;
        if (updates.availableColors !== undefined) {
          payload.colors = updates.availableColors.map((c) => ({ name: c.name, hex: c.hex }));
        }
        if (updates.modelUrl !== undefined) payload.model_url = updates.modelUrl;
        if (updates.modelJobId !== undefined) payload.model_job_id = updates.modelJobId;
        if (updates.modelStatus !== undefined) payload.model_status = updates.modelStatus;
        if (updates.modelError !== undefined) payload.model_error = updates.modelError;

        const res = await api.updateCatalogItem(id, payload);
        const updated = res.data as CatalogItem;
        set((s) => ({
          catalogItems: s.catalogItems.map((item) => (item.id === id ? updated : item)),
        }));
      },

      deleteCatalogItem: async (id) => {
        await api.deleteCatalogItem(id);
        set((s) => ({ catalogItems: s.catalogItems.filter((item) => item.id !== id) }));
      },

      // Materials
      fetchMaterials: async () => {
        if (materialsFetchPromise) {
          return materialsFetchPromise;
        }
        materialsFetchPromise = (async () => {
          try {
            const res = await api.getMaterials();
            set({ materials: normalizeListResponse<Material>(res) });
          } catch (e) {
            console.error("fetchMaterials failed", e);
          } finally {
            setTimeout(() => {
              materialsFetchPromise = null;
            }, 250);
          }
        })();
        return materialsFetchPromise;
      },

      addMaterial: async (material) => {
        const payload: Record<string, unknown> = {
          mode_id: material.modeId,
          sub_mode_id: material.subModeId || null,
          name: material.name,
          type: material.type,
          types: material.types?.length ? material.types : [material.type],
          categories: material.categories ?? [material.category],
          color: material.color,
          color_hex: material.colorHex,
          color_code: material.colorCode,
          price: material.price,
          price_per_unit: material.pricePerUnit,
          currency: material.currency,
          unit: material.unit,
          image: material.image,
          image_url: material.imageUrl,
          sheet_width_cm: material.sheetWidthCm ?? null,
          sheet_height_cm: material.sheetHeightCm ?? null,
          grain_direction: material.grainDirection ?? null,
          kerf_mm: material.kerfMm ?? null,
          is_active: material.isActive,
        };
        const res = await api.createMaterial(payload);
        const newMat = res.data as Material;
        set((s) => ({ materials: [newMat, ...s.materials] }));
        return newMat;
      },

      updateMaterial: async (id, updates) => {
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.types !== undefined) payload.types = updates.types;
        if (updates.categories !== undefined) payload.categories = updates.categories;
        else if (updates.category !== undefined) payload.categories = [updates.category];
        if (updates.color !== undefined) payload.color = updates.color;
        if (updates.colorHex !== undefined) payload.color_hex = updates.colorHex;
        if (updates.colorCode !== undefined) payload.color_code = updates.colorCode;
        if (updates.price !== undefined) payload.price = updates.price;
        if (updates.pricePerUnit !== undefined) payload.price_per_unit = updates.pricePerUnit;
        if (updates.currency !== undefined) payload.currency = updates.currency;
        if (updates.unit !== undefined) payload.unit = updates.unit;
        if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
        if (updates.sheetWidthCm !== undefined)
          payload.sheet_width_cm = updates.sheetWidthCm;
        if (updates.sheetHeightCm !== undefined)
          payload.sheet_height_cm = updates.sheetHeightCm;
        if (updates.grainDirection !== undefined)
          payload.grain_direction = updates.grainDirection;
        if (updates.kerfMm !== undefined) payload.kerf_mm = updates.kerfMm;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;

        const res = await api.updateMaterial(id, payload);
        const updated = res.data as Material;
        set((s) => ({
          materials: s.materials.map((m) => (m.id === id ? updated : m)),
        }));
      },

      deleteMaterial: async (id) => {
        await api.deleteMaterial(id);
        set((s) => ({ materials: s.materials.filter((m) => m.id !== id) }));
      },

      fetchMaterialTemplates: async (params) => {
        try {
          const res = await api.getMaterialTemplates(params);
          set({ materialTemplates: normalizeListResponse<MaterialTemplate>(res) });
        } catch (e) {
          console.error("fetchMaterialTemplates failed", e);
        }
      },

      importMaterialTemplates: async (payload) => {
        const body: Record<string, unknown> = {
          template_ids: payload.templateIds,
          mode_id: payload.modeId,
          price_per_unit: payload.pricePerUnit,
          currency: payload.currency,
        };
        if (payload.subModeId !== undefined) {
          body.sub_mode_id = payload.subModeId || null;
        }
        if (payload.categories?.length) {
          body.categories = payload.categories;
        }
        const res = await api.importMaterialTemplates(body);
        const imported = normalizeListResponse<Material>(res);
        set((s) => ({ materials: [...imported, ...s.materials] }));
        return imported;
      },

      bulkUpdateMaterials: async (payload) => {
        const body: Record<string, unknown> = {
          ids: payload.ids,
          price_per_unit: payload.pricePerUnit,
          price: payload.price ?? payload.pricePerUnit,
        };
        if (payload.currency !== undefined) {
          body.currency = payload.currency;
        }
        const res = await api.bulkUpdateMaterials(body);
        const updated = normalizeListResponse<Material>(res);
        const byId = new Map(updated.map((m) => [m.id, m]));
        set((s) => ({
          materials: s.materials.map((m) => byId.get(m.id) ?? m),
        }));
      },

      // Modules
      fetchModules: async () => {
        const res = await api.getModules();
        set({
          modules: normalizeListResponse<Module>(res).map((row) => normalizeModuleFromApi(row)),
        });
      },

      addModule: async (module) => {
        const payload: Record<string, unknown> = {
          mode_id: module.modeId,
          sub_mode_id: module.subModeId,
          name: module.name,
          description: module.description,
          width: module.sizes.width,
          height: module.sizes.height,
          depth: module.sizes.depth,
          dimension_unit: module.sizes.unit,
          price: module.price,
          category: module.category,
          is_active: module.isActive,
          images: module.images,
          connection_points: module.connectionPoints
            ? Object.entries(module.connectionPoints)
                .filter(([, v]) => v)
                .map(([k]) => ({ position: k, type: "default" }))
            : [],
          compatible_with: module.compatibleWith,
          placement_type: module.placementType ?? 'floor',
        };
        if (module.modelUrl !== undefined) payload.model_url = module.modelUrl;
        if (module.modelJobId !== undefined) payload.model_job_id = module.modelJobId;
        if (module.modelStatus !== undefined) payload.model_status = module.modelStatus;
        if (module.modelError !== undefined) payload.model_error = module.modelError;
        if (module.currency !== undefined) payload.currency = module.currency;
        if (module.isConfigurableTemplate !== undefined) {
          payload.is_configurable_template = module.isConfigurableTemplate;
        }
        if (module.pricingBodyWeight !== undefined) {
          payload.pricing_body_weight = module.pricingBodyWeight;
        }
        if (module.pricingDoorWeight !== undefined) {
          payload.pricing_door_weight = module.pricingDoorWeight;
        }
        if (module.defaultCabinetMaterialId !== undefined) {
          payload.default_cabinet_material_id = module.defaultCabinetMaterialId || null;
        }
        if (module.defaultDoorMaterialId !== undefined) {
          payload.default_door_material_id = module.defaultDoorMaterialId || null;
        }
        if (module.defaultHandleId !== undefined) {
          payload.default_handle_id = module.defaultHandleId || null;
        }
        if (module.templateOptions !== undefined) {
          payload.template_options = module.templateOptions;
        }
        if (module.allowedHandleIds !== undefined) {
          payload.allowed_handle_ids = module.allowedHandleIds;
        }
        const res = await api.createModule(payload);
        const newMod = normalizeModuleFromApi(res.data);
        set((s) => ({ modules: [newMod, ...s.modules] }));
        return newMod;
      },

      updateModule: async (id, updates) => {
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.sizes) {
          payload.width = updates.sizes.width;
          payload.height = updates.sizes.height;
          payload.depth = updates.sizes.depth;
          payload.dimension_unit = updates.sizes.unit;
        }
        if (updates.price !== undefined) payload.price = updates.price;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.isActive !== undefined) payload.is_active = updates.isActive;
        if (updates.images !== undefined) payload.images = updates.images;
        if (updates.connectionPoints !== undefined) {
          payload.connection_points = Object.entries(updates.connectionPoints)
            .filter(([, v]) => v)
            .map(([k]) => ({ position: k, type: "default" }));
        }
        if (updates.compatibleWith !== undefined) payload.compatible_with = updates.compatibleWith;
        if (updates.modelUrl !== undefined) payload.model_url = updates.modelUrl;
        if (updates.modelJobId !== undefined) payload.model_job_id = updates.modelJobId;
        if (updates.modelStatus !== undefined) payload.model_status = updates.modelStatus;
        if (updates.modelError !== undefined) payload.model_error = updates.modelError;
        if (updates.placementType !== undefined) payload.placement_type = updates.placementType;
        if (updates.currency !== undefined) payload.currency = updates.currency;
        if (updates.isConfigurableTemplate !== undefined) {
          payload.is_configurable_template = updates.isConfigurableTemplate;
        }
        if (updates.pricingBodyWeight !== undefined) {
          payload.pricing_body_weight = updates.pricingBodyWeight;
        }
        if (updates.pricingDoorWeight !== undefined) {
          payload.pricing_door_weight = updates.pricingDoorWeight;
        }
        if (updates.defaultCabinetMaterialId !== undefined) {
          payload.default_cabinet_material_id = updates.defaultCabinetMaterialId || null;
        }
        if (updates.defaultDoorMaterialId !== undefined) {
          payload.default_door_material_id = updates.defaultDoorMaterialId || null;
        }
        if (updates.defaultHandleId !== undefined) {
          payload.default_handle_id = updates.defaultHandleId || null;
        }
        if (updates.templateOptions !== undefined) {
          payload.template_options = updates.templateOptions;
        }
        if (updates.allowedHandleIds !== undefined) {
          payload.allowed_handle_ids = updates.allowedHandleIds;
        }

        const res = await api.updateModule(id, payload);
        const updated = normalizeModuleFromApi(res.data);
        set((s) => ({
          modules: s.modules.map((m) => (m.id === id ? updated : m)),
        }));
      },

      deleteModule: async (id) => {
        await api.deleteModule(id);
        set((s) => ({ modules: s.modules.filter((m) => m.id !== id) }));
      },

      // Orders
      fetchOrders: async () => {
        const res = await api.getOrders();
        set({ orders: res.data as Order[] });
      },

      addOrder: async (order) => {
        const payload: Record<string, unknown> = {
          customer_name: order.customerName,
          customer_email: order.customerEmail,
          customer_phone: order.customerPhone,
          type: order.type,
          total_price: order.totalPrice,
          status: order.status,
          notes: order.notes,
          items: order.items.map((item) => ({
            item_type: item.itemType,
            item_id: item.itemId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            selected_materials: item.selectedMaterials,
            custom_data: item.customData,
          })),
        };
        const res = await api.createOrder(payload);
        const newOrder = res.data as Order;
        set((s) => ({ orders: [newOrder, ...s.orders] }));
        return newOrder;
      },

      updateOrderStatus: async (id, status, notes) => {
        const payload: Record<string, unknown> = { status };
        if (notes) payload.notes = notes;
        const res = await api.updateOrder(id, payload);
        const updated = res.data as Order;
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? updated : o)),
        }));
      },

      // Public data
      getAdminBySlug: async (slug) => {
        try {
          const res = await api.getPublicAdmin(slug);
          return normalizeUserFromApi(res.data as User);
        } catch {
          return undefined;
        }
      },

      getPublicCatalog: async (slug) => {
        const res = await api.getPublicCatalog(slug);
        return res.data as CatalogItem[];
      },

      getPublicMaterials: async (slug) => {
        const res = await api.getPublicMaterials(slug);
        return res.data as Material[];
      },

      getPublicModules: async (slug) => {
        const res = await api.getPublicModules(slug);
        return normalizeListResponse<Module>(res).map((row) => normalizeModuleFromApi(row));
      },
    }),
    {
      name: "metrics-platform-storage",
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState;
        const p = persistedState as { currentUser?: User | null };
        if (p.currentUser) {
          return {
            ...p,
            currentUser: normalizeUserFromApi(p.currentUser),
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export function useHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) {
      queueMicrotask(() => setHydrated(true));
    }
    return () => unsub();
  }, []);

  return hydrated;
}
