import { ReactElement, ComponentType } from "react";
import { ComponentConfig } from "@puckeditor/core";
import styles from "./styles.module.css";
import { getClassNameFactory } from "../../lib/get-class-name-factory";
import {
  // Common UI icons
  Star, Heart, Home, Settings, User, Users, Mail, Phone, Calendar, Clock,
  Search, Check, X, Plus, Minus, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ExternalLink, Link, Download, Upload,
  // Content icons
  FileText, Image, Video, Music, Folder, File, Bookmark, Tag, Hash, AtSign,
  // Actions icons
  Edit, Trash, Copy, Clipboard, Share, Send, Save, Printer, RefreshCw, RotateCcw,
  // Business icons
  ShoppingCart, CreditCard, DollarSign, TrendingUp, BarChart, PieChart, Activity,
  // Communication icons
  MessageCircle, MessageSquare, Bell, Volume2, Mic, Camera, Globe, Wifi,
  // Nature icons
  Sun, Moon, Cloud, Zap, Feather, Leaf, Flower, Mountain,
  // Objects icons
  Gift, Award, Shield, Key, Lock, Unlock, Eye, EyeOff, Map, MapPin,
  // Tech icons  
  Code, Terminal, Cpu, Monitor, Smartphone, Laptop, Database, Server, HardDrive,
  // Misc icons
  AlertCircle, AlertTriangle, Info, HelpCircle, CheckCircle, XCircle, Sparkles, Lightbulb
} from "lucide-react";
import { withLayout, WithLayout } from "../../components/Layout";

const getClassName = getClassNameFactory("Card", styles);

// Curated list of commonly used icons for cards
const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  // Common UI
  Star, Heart, Home, Settings, User, Users, Mail, Phone, Calendar, Clock,
  Search, Check, X, Plus, Minus, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ExternalLink, Link, Download, Upload,
  // Content
  FileText, Image, Video, Music, Folder, File, Bookmark, Tag, Hash, AtSign,
  // Actions
  Edit, Trash, Copy, Clipboard, Share, Send, Save, Printer, RefreshCw, RotateCcw,
  // Business
  ShoppingCart, CreditCard, DollarSign, TrendingUp, BarChart, PieChart, Activity,
  // Communication
  MessageCircle, MessageSquare, Bell, Volume2, Mic, Camera, Globe, Wifi,
  // Nature
  Sun, Moon, Cloud, Zap, Feather, Leaf, Flower, Mountain,
  // Objects
  Gift, Award, Shield, Key, Lock, Unlock, Eye, EyeOff, Map, MapPin,
  // Tech
  Code, Terminal, Cpu, Monitor, Smartphone, Laptop, Database, Server, HardDrive,
  // Misc
  AlertCircle, AlertTriangle, Info, HelpCircle, CheckCircle, XCircle, Sparkles, Lightbulb
};

const iconOptions = Object.keys(iconMap).map((iconName) => ({
  label: iconName,
  value: iconName,
}));


export type CardProps = WithLayout<{
  title: string;
  description: string;
  icon?: string;
  mode: "flat" | "card";
}>;

const CardInner: ComponentConfig<CardProps> = {
  fields: {
    title: {
      type: "text",
      contentEditable: true,
    },
    description: {
      type: "textarea",
      contentEditable: true,
    },
    icon: {
      type: "select",
      options: iconOptions,
    },
    mode: {
      type: "radio",
      options: [
        { label: "card", value: "card" },
        { label: "flat", value: "flat" },
      ],
    },
  },
  defaultProps: {
    title: "Title",
    description: "Description",
    icon: "Feather",
    mode: "flat",
  },
  render: ({ title, icon, description, mode }) => {
    const IconComponent = icon ? iconMap[icon] : null;

    return (
      <div className={getClassName({ [mode]: true })}>
        <div className={getClassName("inner")}>
          <div className={getClassName("icon")}>
            {IconComponent && <IconComponent />}
          </div>

          <div className={getClassName("title")}>{title}</div>
          <div className={getClassName("description")}>{description}</div>
        </div>
      </div>
    );
  },
};

export const Card = withLayout(CardInner);
