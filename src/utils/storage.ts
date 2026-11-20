/**
 * 本機瀏覽器 localStorage 持久化儲存管理
 */

export function saveDraft<T>(toolId: string, data: T): void {
  try {
    const key = `lab_tool_${toolId}_draft`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[storage] Failed to save draft for ${toolId}:`, err);
  }
}

export function loadDraft<T>(toolId: string, fallback: T): T {
  try {
    const key = `lab_tool_${toolId}_draft`;
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (err) {
    console.warn(`[storage] Failed to load draft for ${toolId}:`, err);
    return fallback;
  }
}

export function clearDraft(toolId: string): void {
  try {
    const key = `lab_tool_${toolId}_draft`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] Failed to clear draft for ${toolId}:`, err);
  }
}

export interface StoredTemplate<T> {
  id: string;
  name: string;
  createdAt: string;
  data: T;
}

export function getCustomTemplates<T>(toolId: string): StoredTemplate<T>[] {
  try {
    const key = `lab_tool_${toolId}_templates`;
    const item = localStorage.getItem(key);
    if (!item) return [];
    return JSON.parse(item) as StoredTemplate<T>[];
  } catch (err) {
    console.warn(`[storage] Failed to load templates for ${toolId}:`, err);
    return [];
  }
}

export function saveCustomTemplate<T>(toolId: string, name: string, data: T): void {
  try {
    const key = `lab_tool_${toolId}_templates`;
    const existing = getCustomTemplates<T>(toolId);
    const newTemplate: StoredTemplate<T> = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toLocaleDateString('zh-TW'),
      data,
    };
    localStorage.setItem(key, JSON.stringify([...existing, newTemplate]));
  } catch (err) {
    console.warn(`[storage] Failed to save template for ${toolId}:`, err);
  }
}

export function deleteCustomTemplate<T>(toolId: string, templateId: string): void {
  try {
    const key = `lab_tool_${toolId}_templates`;
    const existing = getCustomTemplates<T>(toolId);
    const filtered = existing.filter(t => t.id !== templateId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (err) {
    console.warn(`[storage] Failed to delete template for ${toolId}:`, err);
  }
}
