import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppSelector, useAppDispatch } from "@/store";
import { setSelectedShop } from "@/store/shopSlice";
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

  const { data, isLoading } = useQuery({
    queryKey: ["/api/shops", { limit: 100 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/shops?limit=100");
      return response.json();
    },
  });

  const shops: Shop[] = data?.shops || [];

  // Don't render if user has 0 or 1 shops
  if (isLoading || shops.length <= 1) {
    return null;
  }

  return (
    <Select
      value={selectedShopId ?? "all"}
      onValueChange={(value) =>
        dispatch(setSelectedShop(value === "all" ? null : value))
      }
    >
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
