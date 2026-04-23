import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector, useAppDispatch } from "@/store";
import { setSelectedShop } from "@/store/shopSlice";
import { useReduxAuth } from "@/hooks/useReduxAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store } from "lucide-react";

interface Shop {
  id: string;
  name: string;
  status: string;
}

export function ShopSelector() {
  const dispatch = useAppDispatch();
  const selectedShopId = useAppSelector((state) => state.shop.selectedShopId);
  const { user, isAuthenticated } = useReduxAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops?limit=100");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const shops: Shop[] = data?.shops || [];

  // Server-stored per-user preference. Lets the shop selection survive logout
  // (which purges redux-persist) and follow the user across devices.
  const { data: preferenceData } = useQuery<{ shopId: string | null }>({
    queryKey: ["/api/users/shop-preference", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users/shop-preference");
      return response.json();
    },
    enabled: isAuthenticated && !!user?.id,
    staleTime: Infinity,
  });

  const hydratedForUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!preferenceData || !user?.id) return;
    if (hydratedForUserRef.current === user.id) return;

    const storedId = preferenceData.shopId;
    // Defend against stale FK values: if the shop list is loaded and the
    // stored shop no longer exists, fall back to "All Shops" instead of
    // silently pointing at a deleted shop.
    if (storedId && shops.length > 0 && !shops.some((s) => s.id === storedId)) {
      if (selectedShopId !== null) dispatch(setSelectedShop(null));
      hydratedForUserRef.current = user.id;
      return;
    }

    if (storedId !== selectedShopId) {
      dispatch(setSelectedShop(storedId));
    }

    if (storedId === null || shops.length > 0) {
      hydratedForUserRef.current = user.id;
    }
  }, [preferenceData, user?.id, shops, selectedShopId, dispatch]);

  const handleChange = (value: string) => {
    const nextId = value === "all" ? null : value;
    dispatch(setSelectedShop(nextId));
    // Fire-and-forget — UI has already updated optimistically.
    apiRequest("PATCH", "/api/users/shop-preference", { shopId: nextId }).catch(
      (error) => {
        console.warn("[ShopSelector] Failed to persist shop preference:", error);
      },
    );
  };

  // Don't render if user has 0 or 1 shops
  if (isLoading || shops.length <= 1) {
    return null;
  }

  return (
    <Select value={selectedShopId ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px] h-9 text-sm">
        <Store className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="All Shops" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Shops</SelectItem>
        {shops.map((shop) => (
          <SelectItem key={shop.id} value={shop.id}>
            {shop.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
