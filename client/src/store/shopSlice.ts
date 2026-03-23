import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ShopState {
  selectedShopId: string | null; // null = "All Shops"
}

const initialState: ShopState = {
  selectedShopId: null,
};

const shopSlice = createSlice({
  name: "shop",
  initialState,
  reducers: {
    setSelectedShop: (state, action: PayloadAction<string | null>) => {
      state.selectedShopId = action.payload;
    },
    clearSelectedShop: (state) => {
      state.selectedShopId = null;
    },
  },
});

export const { setSelectedShop, clearSelectedShop } = shopSlice.actions;
export default shopSlice.reducer;
