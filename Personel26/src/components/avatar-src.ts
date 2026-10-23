"use client";
/**
 * Profil fotoğrafı adresi.
 *
 * Sunuculu sürümde doğrudan `/api/personnel/avatar/[id]` adresi kullanılır.
 * GitHub Pages (statik) sürümünde sunucu olmadığı için fotoğraf, tarayıcıdaki
 * veritabanı köprüsü üzerinden okunup geçici (blob) adrese çevrilir.
 */
import { useEffect, useState } from "react";

type Person = { id: string; hasAvatar?: boolean; avatarUpdatedAt?: string | null };

type BridgeWindow = Window & {
  __p26?: {
    avatarUrl?: (id: string, version?: string | null) => Promise<string | null>;
  };
};

/** Personelin fotoğrafı var mı? (yoksa baş harfler gösterilir) */
export function hasAvatar(person: Person): boolean {
  return Boolean(person.hasAvatar);
}

/** Sunuculu sürümün klasik adresi. */
export function defaultAvatarSrc(person: Person): string | null {
  if (!person.hasAvatar) return null;
  const version = person.avatarUpdatedAt ? Date.parse(person.avatarUpdatedAt) || 0 : 0;
  return `/api/personnel/avatar/${person.id}${version ? `?v=${version}` : ""}`;
}

/**
 * Fotoğraf adresini döndürür: statik sürümde blob adresi (asenkron hazırlanır),
 * sunuculu sürümde doğrudan API adresi.
 */
export function useAvatarSrc(person: Person): string | null {
  const isStatic = typeof window !== "undefined" && Boolean((window as BridgeWindow).__p26?.avatarUrl);
  // Adres, hangi personel için üretildiğiyle birlikte tutulur; böylece personel
  // değiştiğinde eski fotoğraf bir an için görünmez (setState efekt içinde
  // senkron çağrılmaz, yalnızca asenkron yanıt geldiğinde güncellenir).
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    const bridge = (window as BridgeWindow).__p26;
    if (!person.hasAvatar || !bridge?.avatarUrl) return; // sunuculu sürüm: API adresi yeterli
    let alive = true;
    bridge
      .avatarUrl(person.id, person.avatarUpdatedAt ?? null)
      .then(url => {
        if (alive) setLoaded({ id: person.id, url });
      })
      .catch(() => {
        if (alive) setLoaded({ id: person.id, url: null });
      });
    return () => {
      alive = false;
    };
  }, [person.id, person.hasAvatar, person.avatarUpdatedAt]);

  if (!person.hasAvatar) return null;
  if (!isStatic) return defaultAvatarSrc(person);
  return loaded && loaded.id === person.id ? loaded.url : null;
}
