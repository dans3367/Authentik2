import { useCallback, memo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ContactSearchProps {
  value: string;
  onSearchChange: (search: string) => void;
  placeholder?: string;
}

const ContactSearchComponent = ({ value, onSearchChange, placeholder = "Search contacts..." }: ContactSearchProps) => {
  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  }, [onSearchChange]);

  // Handle key down to prevent form submission on Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5 pointer-events-none z-10" />
      <Input
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="pl-10"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
};

export const ContactSearch = memo(ContactSearchComponent);