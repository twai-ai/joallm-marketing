-- Migration: Add notebooks and notebook_cells tables
-- Created: 2025-11-08
-- Purpose: Enable persistent notebook storage for interactive data analysis

-- Create notebooks table
CREATE TABLE IF NOT EXISTS notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create notebook_cells table
CREATE TABLE IF NOT EXISTS notebook_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  cell_type TEXT NOT NULL CHECK (cell_type IN ('markdown', 'code', 'ai', 'chart', 'knowledge', 'agent', 'debug')),
  content TEXT NOT NULL,
  output TEXT,
  execution_count INTEGER DEFAULT 0,
  
  -- Cell position in notebook
  position INTEGER NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- For knowledge cells
  attached_documents JSONB DEFAULT '[]',
  rag_config JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS notebooks_user_id_idx ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS notebooks_created_at_idx ON notebooks(created_at);
CREATE INDEX IF NOT EXISTS notebooks_is_public_idx ON notebooks(is_public);

CREATE INDEX IF NOT EXISTS notebook_cells_notebook_id_idx ON notebook_cells(notebook_id);
CREATE INDEX IF NOT EXISTS notebook_cells_position_idx ON notebook_cells(position);
CREATE INDEX IF NOT EXISTS notebook_cells_cell_type_idx ON notebook_cells(cell_type);

-- Add updated_at triggers
CREATE TRIGGER update_notebooks_updated_at 
  BEFORE UPDATE ON notebooks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notebook_cells_updated_at 
  BEFORE UPDATE ON notebook_cells 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE notebooks IS 'User notebooks for interactive data analysis and AI experimentation';
COMMENT ON TABLE notebook_cells IS 'Individual cells within notebooks (markdown, code, AI, etc.)';
COMMENT ON COLUMN notebook_cells.cell_type IS 'Type of cell: markdown, code, ai, chart, knowledge, agent, or debug';
COMMENT ON COLUMN notebook_cells.position IS 'Order position of cell within notebook';
COMMENT ON COLUMN notebook_cells.attached_documents IS 'Array of document IDs attached to knowledge cells';
COMMENT ON COLUMN notebook_cells.rag_config IS 'RAG configuration for knowledge cells';

