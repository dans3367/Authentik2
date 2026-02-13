import { Button } from "./blocks/Button";
import { Card } from "./blocks/Card";
import { Grid } from "./blocks/Grid";
import { Hero } from "./blocks/Hero";
import { Heading } from "./blocks/Heading";
import { Flex } from "./blocks/Flex";
import { Logos } from "./blocks/Logos";
import { Stats } from "./blocks/Stats";
import { Text } from "./blocks/Text";
import { Space } from "./blocks/Space";
import { ProductGrid } from "./blocks/ProductGrid";
import { ProductShowcase } from "./blocks/ProductShowcase";

import Root from "./root";
import { UserConfig } from "./types";
import { initialData } from "./initial-data";

export const config: UserConfig = {
  root: Root,
  categories: {
    layout: {
      components: ["Grid", "Flex", "Space"],
    },
    typography: {
      components: ["Heading", "Text"],
    },
    interactive: {
      title: "Actions",
      components: ["Button"],
    },
    content: {
      title: "Content",
      components: ["ProductGrid", "ProductShowcase"],
    },
    other: {
      title: "Other",
      components: ["Card", "Hero", "Logos", "Stats"],
    },
  },
  components: {
    Button,
    Card,
    Grid,
    Hero,
    Heading,
    Flex,
    Logos,
    Stats,
    Text,
    Space,
    ProductGrid,
    ProductShowcase,
  },
};

export { initialData };
export default config;
