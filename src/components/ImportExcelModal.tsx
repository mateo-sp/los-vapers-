import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Play, 
  Check, 
  HelpCircle,
  RefreshCw,
  Eye,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product, ProductInput } from '../types';
import { addProduct, updateProduct, clearAllProducts } from '../services/dbService';
import { sampleProducts } from '../data/sampleProducts';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
}

interface ParsedRow {
  sku: string;
  name: string;
  brand: string;
  category: string;
  stock: number;
  minStock: number;
  costPrice: number;
  sellingPrice: number;
  notes: string;
  isValid: boolean;
  validationError?: string;
}

export default function ImportExcelModal({
  isOpen,
  onClose,
  existingProducts,
}: ImportExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [mergeOption, setMergeOption] = useState<'add_stock' | 'overwrite_stock'>('add_stock');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalization for matching headers
  const normalizeKey = (key: string): string => {
    return String(key || '')
      .toLowerCase()
      .normalize('NFD') // remove accents
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const handleFile = (selectedFile: File) => {
    const fileType = selectedFile.name.split('.').pop()?.toLowerCase();
    if (fileType !== 'xlsx' && fileType !== 'xls' && fileType !== 'csv') {
      setErrorMsg('Formato de archivo inválido. Por favor selecciona Excel (.xlsx, .xls) o CSV.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawData = e.target?.result;
        if (!rawData) throw new Error('No se pudo leer el archivo.');
        
        const dataArray = new Uint8Array(rawData as ArrayBuffer);
        const workbook = XLSX.read(dataArray, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse raw rows as JSON array of objects
        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
        
        if (rawRows.length === 0) {
          throw new Error('El archivo está vacío o no contiene filas con datos válidos.');
        }

        const resolvedRows: ParsedRow[] = rawRows.map((row, index) => {
          const mapped: Partial<ParsedRow> = {
            sku: '',
            name: '',
            brand: 'Otros',
            category: 'General',
            stock: 0,
            minStock: 5,
            costPrice: 0,
            sellingPrice: 0,
            notes: '',
            isValid: true
          };

          // Map dynamic headers
          for (const [rawKey, val] of Object.entries(row)) {
            const keyNorm = normalizeKey(rawKey);
            
            // SKU
            if (/^(sku|cod|codigo|barcode|barras|codigodebarras)$/.test(keyNorm)) {
              mapped.sku = String(val ?? '').trim();
            }
            // Name
            else if (/^(nombre|desc|descripcion|name|title|producto|articulo)$/.test(keyNorm)) {
              mapped.name = String(val ?? '').trim();
            }
            // Brand
            else if (/^(marca|brand|maker|fabricante)$/.test(keyNorm)) {
              mapped.brand = String(val ?? 'Otros').trim();
            }
            // Category
            else if (/^(categoria|category|grupo|linea|rubro)$/.test(keyNorm)) {
              mapped.category = String(val ?? 'General').trim();
            }
            // Stock
            else if (/^(stock|cantidad|qty|unidades|existencias|cantidaddisponible|inventario)$/.test(keyNorm)) {
              mapped.stock = Math.max(0, parseInt(String(val), 10) || 0);
            }
            // Min Stock
            else if (/^(minstock|stockminimo|alertaminimo|minimo|cantidadminima|alerta)$/.test(keyNorm)) {
              mapped.minStock = Math.max(1, parseInt(String(val), 10) || 5);
            }
            // Cost price
            else if (/^(costprice|preciocosto|costo|cost|valorcosto|preciocompra)$/.test(keyNorm)) {
              mapped.costPrice = Math.max(0, parseFloat(String(val)) || 0);
            }
            // Selling price
            else if (/^(sellingprice|precio|precioventa|valorventa|precioalpublico)$/.test(keyNorm)) {
              mapped.sellingPrice = Math.max(0, parseFloat(String(val)) || 0);
            }
            // Notes
            else if (/^(notes|notas|comentarios|descripcionadicional|observaciones|comentario)$/.test(keyNorm)) {
              mapped.notes = String(val ?? '').trim();
            }
          }

          // Validation
          if (!mapped.name) {
            mapped.isValid = false;
            mapped.validationError = `Fila ${index + 2}: El nombre del producto está vacío`;
          } else if (mapped.sellingPrice < 0) {
            mapped.isValid = false;
            mapped.validationError = `Fila ${index + 2}: El precio de venta no puede ser negativo`;
          }

          return mapped as ParsedRow;
        });

        setParsedRows(resolvedRows);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err?.message || 'Error al procesar el archivo Excel. Verifica el formato e intenta nuevamente.');
        setFile(null);
        setParsedRows([]);
      }
    };
    
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const selectManualFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (parsedRows.length === 0) return;
    
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('No hay filas válidas para importar en el archivo.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setUploadProgress({ current: 0, total: validRows.length });

    try {
      // 1. If 'replace' mode selected, erase the entire products collection first
      if (importMode === 'replace') {
        const confirmClear = window.confirm(
          'Atención: El modo "Reemplazar catálogo" eliminará permanentemente TODOS los productos actuales de la base de datos antes de importar. ¿Estás seguro?'
        );
        if (!confirmClear) {
          setIsProcessing(false);
          return;
        }
        await clearAllProducts();
      }

      // 2. Iterate and update/create products sequentially while keeping real-time progress state
      let updatedCount = 0;
      let createdCount = 0;

      for (let i = 0; i < validRows.length; i++) {
        const r = validRows[i];
        
        // Find if product with same SKU or Name already exists in database
        let existing: Product | null = null;
        if (importMode === 'merge') {
          if (r.sku) {
            existing = existingProducts.find(p => p.sku === r.sku) || null;
          } else {
            existing = existingProducts.find(p => p.name.toLowerCase() === r.name.toLowerCase()) || null;
          }
        }

        const productInput: ProductInput = {
          sku: r.sku || `SKU-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
          name: r.name,
          brand: r.brand || 'Otros',
          category: r.category || 'General',
          stock: r.stock,
          minStock: r.minStock,
          costPrice: r.costPrice,
          sellingPrice: r.sellingPrice,
          notes: r.notes || '',
          useCategoryThreshold: false
        };

        if (existing) {
          // If merging, calculate final stock based on user selection
          const finalStock = mergeOption === 'add_stock' 
            ? existing.stock + r.stock 
            : r.stock;
            
          await updateProduct(existing.id, {
            ...productInput,
            stock: finalStock,
            previousState: existing
          });
          updatedCount++;
        } else {
          await addProduct(productInput);
          createdCount++;
        }

        // Update progress state hook
        setUploadProgress({ current: i + 1, total: validRows.length });
      }

      setSuccessMsg(
        importMode === 'replace' 
          ? `¡Importación exitosa! Se han creado ${createdCount} productos nuevos con limpio catálogo de arranque.`
          : `¡Importación completada! Se crearon ${createdCount} nuevos productos y se actualizaron/sumaron ${updatedCount} productos preexistentes en tu inventario.`
      );
      
      // Reset state variables
      setFile(null);
      setParsedRows([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Ocurrió un error inesperado al guardar los productos en la base de datos de Firestore.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleLoadSampleCatalog = async () => {
    const confirmImport = window.confirm(
      '¿Deseas cargar la lista de productos provista? Este proceso añadirá los ' + sampleProducts.length + ' productos en tu catálogo de la base de datos de Firestore.'
    );
    if (!confirmImport) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploadProgress({ current: 0, total: sampleProducts.length });

    try {
      let createdCount = 0;
      let updatedCount = 0;

      for (let i = 0; i < sampleProducts.length; i++) {
        const item = sampleProducts[i];
        
        // Match existing product in the database by Name and Brand
        const existing = existingProducts.find(
          p => p.name.toLowerCase() === item.name.toLowerCase() && p.brand.toLowerCase() === item.brand.toLowerCase()
        );

        const skuToUse = existing?.sku || item.brand.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 5) + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

        const productInput: ProductInput = {
          sku: skuToUse,
          name: item.name,
          brand: item.brand,
          category: 'Vapes',
          stock: item.stock,
          minStock: 5,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
          notes: 'Cargado desde la lista oficial provista',
          useCategoryThreshold: false
        };

        if (existing) {
          // Add to current stock or keep
          await updateProduct(existing.id, {
            ...productInput,
            stock: existing.stock + item.stock,
            previousState: existing
          });
          updatedCount++;
        } else {
          await addProduct(productInput);
          createdCount++;
        }

        setUploadProgress({ current: i + 1, total: sampleProducts.length });
      }

      setSuccessMsg(
        `¡Catálogo cargado exitosamente! Se agregaron ${createdCount} nuevos productos y se actualizaron ${updatedCount} productos preexistentes.`
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Ocurrió un error inesperado al registrar los productos del sistema.');
    } finally {
      setIsProcessing(false);
    }
  };

  const validRowsCount = parsedRows.filter(r => r.isValid).length;
  const invalidRowsCount = parsedRows.length - validRowsCount;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh]"
            id="import-excel-dialog"
          >
            {/* Ambient background accent glow */}
            <div className="absolute top-[-30%] left-[-20%] w-[250px] h-[250px] rounded-full bg-indigo-500/10 blur-[90px] pointer-events-none" />

            {/* Header */}
            <div className="bg-slate-800/40 px-5.5 py-4 flex items-center justify-between border-b border-white/10 relative z-10">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
                <span className="p-2 bg-indigo-500/15 text-indigo-400 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <h3 className="font-bold leading-none">Importar Excel o CSV</h3>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider font-mono mt-1">Sincronización masiva de inventario</p>
                </div>
              </h2>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content area */}
            <div className="p-5.5 space-y-4 overflow-y-auto relative z-10 flex-1">
              
              {/* Notifications */}
              {errorMsg && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-3.5 text-xs font-semibold flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <p className="leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl p-4 text-xs font-semibold flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  <div className="space-y-1">
                    <p className="font-bold">¡Operación Completada!</p>
                    <p className="text-emerald-300/80 leading-relaxed font-semibold">{successMsg}</p>
                  </div>
                </div>
              )}

              {/* Upload file Box or Loading Progress */}
              {isProcessing ? (
                // Full screen importing loader inside modal
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                  <div className="space-y-1.5 max-w-sm">
                    <p className="text-sm font-bold text-white">Importando productos a Firestore...</p>
                    <p className="text-xs text-slate-400 font-semibold">
                      Subiendo fila {uploadProgress.current} de {uploadProgress.total}
                    </p>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full max-w-md bg-white/5 border border-white/5 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </div>
              ) : !file ? (
                // Dropzone & manual file input representation
                <div className="space-y-4">
                  {/* Explanatory banner */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-[11px] text-slate-300 leading-relaxed flex gap-2">
                    <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                    <div>
                      <span className="font-bold text-white">Encabezados soportados:</span> Nombre del producto, Marca/Fabricante, Categoria, Stock/Cantidad, Precio Venta/Precio, Precio Costo, SKU, Min Alerta, Notas. El sistema detecta automáticamente columnas en inglés y español.
                    </div>
                  </div>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                      isDragging 
                        ? 'border-indigo-400 bg-indigo-500/10' 
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={selectManualFile}
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                    />
                    <UploadCloud className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="text-xs font-bold text-white">Arrastra tu archivo aquí o <span className="text-indigo-400 font-extrabold underline">búscalo desde tu equipo</span></p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Formatos soportados: Excel (.xlsx, .xls) o CSV</p>
                  </div>

                  {/* Or option to load the provided product list directly */}
                  <div className="pt-2">
                    <div className="relative flex items-center justify-center my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/5"></div>
                      </div>
                      <span className="relative px-3 bg-slate-950/40 rounded-full border border-white/5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">o utiliza la lista provista</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSampleCatalog();
                      }}
                      className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-300 font-extrabold hover:text-white transition-all text-xs cursor-pointer shadow-lg shadow-indigo-500/5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                      <span>Cargar Catálogo Inicial de Vapes ({sampleProducts.length} Productos)</span>
                    </button>
                  </div>
                </div>
              ) : (
                // File loaded & Row Preview Mode & Import Configuration
                <div className="space-y-4.5">
                  <div className="flex items-center justify-between bg-slate-800/20 px-4 py-3 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <span className="p-2 bg-indigo-600/15 text-indigo-400 rounded-lg">
                        <FileSpreadsheet className="w-4.5 h-4.5" />
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[280px]">{file.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold font-mono">{(file.size / 1024).toFixed(1)} KB — {parsedRows.length} filas totales</p>
                      </div>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      Cambiar Archivo
                    </button>
                  </div>

                  {/* Settings section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">Modo de Importación</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setImportMode('merge')}
                          className={`px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all ${
                            importMode === 'merge'
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/15'
                              : 'bg-slate-950/40 border-white/10 text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          Unir / Mezclar
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportMode('replace')}
                          className={`px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all ${
                            importMode === 'replace'
                              ? 'bg-rose-600/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/15'
                              : 'bg-slate-950/40 border-white/10 text-slate-300 hover:bg-white/5'
                          }`}
                          title="Borrará permanentemente todos los productos actuales del inventario y cargará los de tu Excel de manera limpia."
                        >
                          Reemplazar Catálogo
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">Manejo de Coincidencias</label>
                      {importMode === 'merge' ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setMergeOption('add_stock')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-tight text-center border transition-all ${
                              mergeOption === 'add_stock'
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                                : 'bg-slate-950/40 border-white/10 text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            Sumar Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => setMergeOption('overwrite_stock')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-bold tracking-tight text-center border transition-all ${
                              mergeOption === 'overwrite_stock'
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-md'
                                : 'bg-slate-950/40 border-white/10 text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            Sobrescribir stock
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-[34px] border border-dashed border-rose-500/30 bg-rose-500/5 text-rose-300 font-bold text-[10px] rounded-lg">
                          🗑️ Se eliminará todo el catálogo actual
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary of validation */}
                  <div className="flex justify-between text-xs font-bold text-slate-300 px-1">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {validRowsCount} filas válidas listas
                    </span>
                    {invalidRowsCount > 0 && (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        {invalidRowsCount} filas inválidas (se omitirán)
                      </span>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
                      <Eye className="w-3.5 h-3.5 text-indigo-400" /> Vista previa de los primeros productos
                    </div>
                    <div className="border border-white/10 rounded-xl overflow-hidden text-xs max-h-[170px] overflow-y-auto">
                      <table className="w-full text-left border-collapse bg-slate-950/40">
                        <thead className="bg-slate-800/60 sticky top-0 border-b border-white/10 font-bold text-slate-300 text-[10px] uppercase font-mono">
                          <tr>
                            <th className="px-3 py-2">Nombre</th>
                            <th className="px-3 py-2">Marca</th>
                            <th className="px-3 py-2">Categoría</th>
                            <th className="px-3 py-2 text-right">Stock</th>
                            <th className="px-3 py-2 text-right">Precio Venta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-semibold text-slate-200">
                          {parsedRows.slice(0, 5).map((row, index) => (
                            <tr key={index} className={row.isValid ? 'hover:bg-white/5' : 'bg-red-950/15 text-rose-300'}>
                              <td className="px-3 py-1.5 truncate max-w-[140px]" title={row.name}>
                                {row.name || <span className="text-rose-400 italic">Vacio</span>}
                              </td>
                              <td className="px-3 py-1.5">{row.brand}</td>
                              <td className="px-3 py-1.5">{row.category}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{row.stock}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-emerald-400">${row.sellingPrice.toLocaleString('es-CL')}</td>
                            </tr>
                          ))}
                          {parsedRows.length > 5 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-1.5 text-center text-[10px] text-slate-400 italic font-mono uppercase tracking-wide bg-slate-800/10">
                                ... y {parsedRows.length - 5} productos más en la cola del archivo ...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!isProcessing && (
              <div className="bg-slate-800/40 px-5.5 py-4 border-t border-white/10 flex justify-between gap-3 relative z-10 text-xs font-bold leading-normal">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4.5 py-2.5 rounded-xl border border-white/10 font-bold text-slate-300 hover:text-white hover:bg-white/5 bg-transparent transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                {file && parsedRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleStartImport}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-5.5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-500/20 select-none transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Iniciar Importación ({validRowsCount} items)</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
