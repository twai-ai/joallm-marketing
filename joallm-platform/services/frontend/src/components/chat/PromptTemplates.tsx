import React from 'react';
import { Search, Tag, Star } from 'lucide-react';

interface Template {
  name: string;
  prompt: string;
  category: string;
}

interface PromptTemplatesProps {
  templates: Template[];
  onSelect: (template: Template) => void;
}

export function PromptTemplates({ templates, onSelect }: PromptTemplatesProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('all');

  const categories = ['all', ...new Set(templates.map(t => t.category))];
  
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.prompt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900 mb-3">Prompt Templates</h3>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-joa-primary focus:border-joa-primary"
          />
        </div>
        
        {/* Categories */}
        <div className="flex flex-wrap gap-1">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === category
                  ? 'bg-joa-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Templates List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <Tag className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No templates found</p>
          </div>
        ) : (
          filteredTemplates.map((template, index) => (
            <div
              key={index}
              onClick={() => onSelect(template)}
              className="p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-red-300 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900 group-hover:text-joa-primary">
                  {template.name}
                </h4>
                <Star className="w-4 h-4 text-gray-300 group-hover:text-yellow-400" />
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {template.prompt}
              </p>
              <div className="mt-2">
                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {template.category}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}