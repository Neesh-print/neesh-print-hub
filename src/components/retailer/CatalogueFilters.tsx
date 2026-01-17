import { useState } from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ButtonPrimary, ButtonSecondary } from "@/components/neesh";

export type SortOption = "newest" | "oldest" | "price-asc" | "price-desc" | "title-asc" | "title-desc";

export interface CatalogueFilters {
  priceRange: [number, number];
  categories: string[];
  publishers: string[];
  inStock: boolean;
}

export interface CatalogueFilterProps {
  filters: CatalogueFilters;
  onFiltersChange: (filters: CatalogueFilters) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  availableCategories: string[];
  availablePublishers: { id: string; name: string }[];
  maxPrice: number;
  activeFilterCount: number;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "title-asc", label: "Title: A to Z" },
  { value: "title-desc", label: "Title: Z to A" },
];

// Sort Dropdown Component
export function SortDropdown({
  sortBy,
  onSortChange,
}: {
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}) {
  return (
    <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Sort by..." />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Category Filter Pills
export function CategoryFilter({
  categories,
  selectedCategories,
  onChange,
}: {
  categories: string[];
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}) {
  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      onChange(selectedCategories.filter((c) => c !== category));
    } else {
      onChange([...selectedCategories, category]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => toggleCategory(category)}
          className={`
            px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${selectedCategories.includes(category)
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }
          `}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

// Price Range Filter
export function PriceRangeFilter({
  value,
  onChange,
  max,
}: {
  value: [number, number];
  onChange: (range: [number, number]) => void;
  max: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Price Range</span>
        <span className="font-medium">
          ${value[0]} - ${value[1]}
        </span>
      </div>
      <Slider
        value={value}
        onValueChange={(v) => onChange(v as [number, number])}
        min={0}
        max={max}
        step={1}
        className="w-full"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>$0</span>
        <span>${max}</span>
      </div>
    </div>
  );
}

// Publisher Multi-Select
export function PublisherFilter({
  publishers,
  selectedPublishers,
  onChange,
}: {
  publishers: { id: string; name: string }[];
  selectedPublishers: string[];
  onChange: (publishers: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const togglePublisher = (id: string) => {
    if (selectedPublishers.includes(id)) {
      onChange(selectedPublishers.filter((p) => p !== id));
    } else {
      onChange([...selectedPublishers, id]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          {selectedPublishers.length > 0
            ? `${selectedPublishers.length} selected`
            : "All Publishers"}
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="max-h-[300px] overflow-y-auto p-2">
          {publishers.map((publisher) => (
            <div
              key={publisher.id}
              className="flex items-center space-x-2 p-2 hover:bg-secondary rounded cursor-pointer"
              onClick={() => togglePublisher(publisher.id)}
            >
              <Checkbox
                checked={selectedPublishers.includes(publisher.id)}
                onCheckedChange={() => togglePublisher(publisher.id)}
              />
              <Label className="cursor-pointer flex-1">{publisher.name}</Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Mobile Filter Sheet
export function MobileFilterSheet({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  availableCategories,
  availablePublishers,
  maxPrice,
  activeFilterCount,
  trigger,
}: CatalogueFilterProps & { trigger: React.ReactNode }) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [localSort, setLocalSort] = useState(sortBy);
  const [open, setOpen] = useState(false);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onSortChange(localSort);
    setOpen(false);
  };

  const handleReset = () => {
    const defaultFilters: CatalogueFilters = {
      priceRange: [0, maxPrice],
      categories: [],
      publishers: [],
      inStock: false,
    };
    setLocalFilters(defaultFilters);
    setLocalSort("newest");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Filters & Sort</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* Sort */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sort By</Label>
            <Select value={localSort} onValueChange={(v) => setLocalSort(v as SortOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Price Range</Label>
            <PriceRangeFilter
              value={localFilters.priceRange}
              onChange={(range) =>
                setLocalFilters({ ...localFilters, priceRange: range })
              }
              max={maxPrice}
            />
          </div>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Categories</Label>
              <CategoryFilter
                categories={availableCategories}
                selectedCategories={localFilters.categories}
                onChange={(categories) =>
                  setLocalFilters({ ...localFilters, categories })
                }
              />
            </div>
          )}

          {/* Publishers */}
          {availablePublishers.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Publishers</Label>
              <PublisherFilter
                publishers={availablePublishers}
                selectedPublishers={localFilters.publishers}
                onChange={(publishers) =>
                  setLocalFilters({ ...localFilters, publishers })
                }
              />
            </div>
          )}

          {/* In Stock */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="inStock"
              checked={localFilters.inStock}
              onCheckedChange={(checked) =>
                setLocalFilters({ ...localFilters, inStock: checked === true })
              }
            />
            <Label htmlFor="inStock" className="cursor-pointer">
              In Stock Only
            </Label>
          </div>
        </div>

        <SheetFooter className="flex-row gap-3 pt-4 border-t">
          <ButtonSecondary onClick={handleReset} className="flex-1">
            Reset
          </ButtonSecondary>
          <ButtonPrimary onClick={handleApply} className="flex-1">
            Apply Filters
          </ButtonPrimary>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Desktop Filter Bar
export function DesktopFilterBar({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  availableCategories,
  availablePublishers,
  maxPrice,
  activeFilterCount,
}: CatalogueFilterProps) {
  const clearAllFilters = () => {
    onFiltersChange({
      priceRange: [0, maxPrice],
      categories: [],
      publishers: [],
      inStock: false,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top row: Sort + Quick filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SortDropdown sortBy={sortBy} onSortChange={onSortChange} />

        <div className="h-6 w-px bg-border" />

        {/* Price Range Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? "border-primary" : ""}
            >
              Price
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px]" align="start">
            <PriceRangeFilter
              value={filters.priceRange}
              onChange={(range) => onFiltersChange({ ...filters, priceRange: range })}
              max={maxPrice}
            />
          </PopoverContent>
        </Popover>

        {/* Publisher Filter */}
        {availablePublishers.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={filters.publishers.length > 0 ? "border-primary" : ""}
              >
                Publisher
                {filters.publishers.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                    {filters.publishers.length}
                  </Badge>
                )}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <div className="max-h-[300px] overflow-y-auto p-2">
                {availablePublishers.map((publisher) => (
                  <div
                    key={publisher.id}
                    className="flex items-center space-x-2 p-2 hover:bg-secondary rounded cursor-pointer"
                    onClick={() => {
                      const newPublishers = filters.publishers.includes(publisher.id)
                        ? filters.publishers.filter((p) => p !== publisher.id)
                        : [...filters.publishers, publisher.id];
                      onFiltersChange({ ...filters, publishers: newPublishers });
                    }}
                  >
                    <Checkbox checked={filters.publishers.includes(publisher.id)} />
                    <span className="text-sm">{publisher.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* In Stock Toggle */}
        <Button
          variant={filters.inStock ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, inStock: !filters.inStock })}
        >
          {filters.inStock && <Check className="mr-1 h-3 w-3" />}
          In Stock
        </Button>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <>
            <div className="h-6 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              <X className="mr-1 h-3 w-3" />
              Clear ({activeFilterCount})
            </Button>
          </>
        )}
      </div>

      {/* Category Pills */}
      {availableCategories.length > 0 && (
        <CategoryFilter
          categories={availableCategories}
          selectedCategories={filters.categories}
          onChange={(categories) => onFiltersChange({ ...filters, categories })}
        />
      )}
    </div>
  );
}

// Active Filter Tags
export function ActiveFilterTags({
  filters,
  onFiltersChange,
  maxPrice,
  publishers,
}: {
  filters: CatalogueFilters;
  onFiltersChange: (filters: CatalogueFilters) => void;
  maxPrice: number;
  publishers: { id: string; name: string }[];
}) {
  const tags: { label: string; onRemove: () => void }[] = [];

  if (filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice) {
    tags.push({
      label: `$${filters.priceRange[0]} - $${filters.priceRange[1]}`,
      onRemove: () => onFiltersChange({ ...filters, priceRange: [0, maxPrice] }),
    });
  }

  filters.categories.forEach((cat) => {
    tags.push({
      label: cat,
      onRemove: () =>
        onFiltersChange({
          ...filters,
          categories: filters.categories.filter((c) => c !== cat),
        }),
    });
  });

  filters.publishers.forEach((pubId) => {
    const pub = publishers.find((p) => p.id === pubId);
    if (pub) {
      tags.push({
        label: pub.name,
        onRemove: () =>
          onFiltersChange({
            ...filters,
            publishers: filters.publishers.filter((p) => p !== pubId),
          }),
      });
    }
  });

  if (filters.inStock) {
    tags.push({
      label: "In Stock",
      onRemove: () => onFiltersChange({ ...filters, inStock: false }),
    });
  }

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pr-1">
          {tag.label}
          <button
            onClick={tag.onRemove}
            className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
