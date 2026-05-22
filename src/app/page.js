'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Package, DollarSign, Truck, CalendarClock, AlertCircle, RefreshCw, 
  ChevronLeft, ChevronRight, Calendar, ArrowUpDown, ArrowUp, ArrowDown, X, Zap
} from 'lucide-react';
import styles from './page.module.css';

const COLORS = ['#2659A5', '#E5273C', '#10b981', '#f59e0b', '#8b5cf6'];

// Utilitário de Parsing Financeiro
const parseCurrencyValue = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  
  const str = String(val).trim();
  
  // Se contiver vírgula, tratamos como formato brasileiro (ex: 1.234,56 ou 37,42)
  if (str.includes(',')) {
    const clean = str.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }
  
  // Se não contiver vírgula, mas contiver ponto (ex: 103.98), tratamos como decimal
  return parseFloat(str) || 0;
};

// Auxiliares de Formatação
const formatCurrency = (val) => {
  const num = parseCurrencyValue(val);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
};

const formatMonthPTBR = (yyyyMM) => {
  if (!yyyyMM) return '';
  const [year, month] = yyyyMM.split('-');
  const months = {
    '01': 'jan.', '02': 'fev.', '03': 'mar.', '04': 'abr.', '05': 'mai.', '06': 'jun.',
    '07': 'jul.', '08': 'ago.', '09': 'set.', '10': 'out.', '11': 'nov.', '12': 'dez.'
  };
  return `${months[month] || month}/${year.slice(2)}`;
};

// Definição dos campos da Tabela para fácil expansão futura
const TABLE_COLUMNS = [
  { key: 'external_id_original', label: 'ID Original' },
  { key: 'external_id_reenvio', label: 'ID Reenvio' },
  { key: 'cliente_nome', label: 'Cliente' },
  { key: 'data_criacao_original', label: 'Data Criação Original', format: formatDate, highlight: true },
  { key: 'data_envio_original', label: 'Data Envio Original', format: formatDate },
  { key: 'total_amount', label: 'Total Amount', format: formatCurrency, highlight: true },
  { key: 'frete', label: 'Frete', format: formatCurrency },
  { key: 'dias_entre_envios', label: 'Dias Reenvio' },
  { key: 'estado_entrega', label: 'Estado' },
  { key: 'cd_origem', label: 'CD Origem' }
];


export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Marca ativa para visualização no Dashboard
  const [selectedBrand, setSelectedBrand] = useState('lescent');

  // Estados para Sincronização via n8n
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncCompany, setSyncCompany] = useState('lescent');
  const [syncYear, setSyncYear] = useState('todos');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Filtro de Período Oficial (Data de Criação Original)
  const [filterStartDate, setFilterStartDate] = useState(null);
  const [filterEndDate, setFilterEndDate] = useState(null);

  // Estados do Calendário Customizado (Popover)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 4, 1)); // Iniciado em Maio 2026 como base do print
  const [tempStartDate, setTempStartDate] = useState(null);
  const [tempEndDate, setTempEndDate] = useState(null);
  const [activeQuickFilter, setActiveQuickFilter] = useState('');
  
  // Ordenação da Tabela
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'default' });

  // Paginação Inteligente
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const [activeTab, setActiveTab] = useState('geral');
  const [cohortMetric, setCohortMetric] = useState('receita');

  const popoverRef = useRef(null);

  // Fechar calendário ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsCalendarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async (brand = selectedBrand) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sheets?company=${brand}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.ok ? await res.json() : null;
      
      if (!res.ok || !json) {
        throw new Error(json?.error || 'Erro ao carregar dados do Sheets');
      }
      
      setData(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBrandChange = (brand) => {
    setSelectedBrand(brand);
    setSyncCompany(brand);
  };

  const handleSyncSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company: syncCompany,
          year: syncYear
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erro ao sincronizar dados com o n8n');
      }

      setSyncMessage({
        type: 'success',
        text: 'Sincronização iniciada com sucesso! Atualizando painel...'
      });

      // Se a marca sincronizada no modal for diferente da ativa, muda a ativa para disparar o useEffect
      if (syncCompany !== selectedBrand) {
        setSelectedBrand(syncCompany);
      } else {
        // Se já for a mesma, recarrega os dados diretamente
        await fetchData(selectedBrand);
      }

      // Fechar modal após sucesso
      setTimeout(() => {
        setIsSyncModalOpen(false);
        setSyncMessage(null);
      }, 2000);
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: `Falha na sincronização: ${err.message}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData(selectedBrand);
  }, [selectedBrand]);

  // Filtrar apenas linhas com ID válido e que pertencem à marca ativa
  const validData = useMemo(() => {
    return data.filter(item => {
      if (!item.external_id_original) return false;
      
      // Se a planilha tiver a coluna empresa, filtramos por ela
      if (item.empresa) {
        const itemBrand = String(item.empresa).toLowerCase().trim().replace(/[\s_-]/g, '');
        const currentBrand = String(selectedBrand).toLowerCase().trim().replace(/[\s_-]/g, '');
        return itemBrand === currentBrand;
      }
      
      return true;
    });
  }, [data, selectedBrand]);

  // Aplicar os Filtros nos Dados (usando data_criacao_original como principal)
  const filteredData = useMemo(() => {
    return validData.filter(item => {
      const dateStr = item.data_criacao_original;
      if (!dateStr) return true;
      
      const itemDate = new Date(dateStr);
      if (isNaN(itemDate.getTime())) return true;

      // Filtro de Data Inicial
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }

      // Filtro de Data Final
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }

      return true;
    });
  }, [validData, filterStartDate, filterEndDate]);

  // Ordenação da tabela
  const sortedData = useMemo(() => {
    if (!sortConfig.key || sortConfig.direction === 'default') {
      return filteredData;
    }
    
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      // Ordenação para datas
      if (sortConfig.key.startsWith('data_')) {
        const isANa = !aVal || aVal === 'N/A';
        const isBNa = !bVal || bVal === 'N/A';
        if (isANa && isBNa) return 0;
        if (isANa) return 1; // N/A sempre no fim
        if (isBNa) return -1;
        
        const dateA = new Date(aVal).getTime();
        const dateB = new Date(bVal).getTime();
        const validA = isNaN(dateA) ? 0 : dateA;
        const validB = isNaN(dateB) ? 0 : dateB;
        
        return sortConfig.direction === 'asc' ? validA - validB : validB - validA;
      }
      
      // Ordenação para moedas ou números
      if (sortConfig.key === 'total_amount' || sortConfig.key === 'frete' || sortConfig.key === 'dias_entre_envios') {
        const numA = parseCurrencyValue(aVal);
        const numB = parseCurrencyValue(bVal);
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }
      
      // Ordenação para strings (A-Z, Z-A) com localeCompare natural
      const strA = String(aVal || '').trim();
      const strB = String(bVal || '').trim();
      const comp = strA.localeCompare(strB, 'pt-BR', { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? comp : -comp;
    });
  }, [filteredData, sortConfig]);

  // Resetar página atual ao mudar filtros ou ordenação
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredData, sortConfig]);

  // Paginação dos dados ordenados e filtrados
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  // Calcular Métricas Dinâmicas (Baseado nos dados FILTRADOS)
  const kpis = useMemo(() => {
    const totalReenvios = filteredData.length;
    
    const totalReceita = filteredData.reduce((acc, curr) => {
      return acc + parseCurrencyValue(curr.total_amount);
    }, 0);
    
    const totalFrete = filteredData.reduce((acc, curr) => {
      return acc + parseCurrencyValue(curr.frete);
    }, 0);
    
    const diasTotal = filteredData.reduce((acc, curr) => acc + (parseFloat(curr.dias_entre_envios) || 0), 0);
    const diasEntreEnviosAvg = totalReenvios > 0 ? (diasTotal / totalReenvios) : 0;

    return {
      totalReenvios,
      totalReceita,
      totalFrete,
      diasEntreEnviosAvg: Math.ceil(diasEntreEnviosAvg) // Arredondado para cima
    };
  }, [filteredData]);


  // Gráfico: Reenvios por Estado (Top 5)
  const chartStates = useMemo(() => {
    const stateCount = filteredData.reduce((acc, curr) => {
      const estado = curr.estado_entrega || 'N/A';
      acc[estado] = (acc[estado] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(stateCount).map(key => ({
      name: key,
      value: stateCount[key]
    })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredData]);

  // Gráfico: Dias entre Envios (Distribuição)
  const chartDaysDist = useMemo(() => {
    const daysDistribution = filteredData.reduce((acc, curr) => {
      const days = parseInt(curr.dias_entre_envios) || 0;
      let range = '0-5 dias';
      if (days > 5 && days <= 15) range = '6-15 dias';
      else if (days > 15 && days <= 30) range = '16-30 dias';
      else if (days > 30) range = '30+ dias';
      
      acc[range] = (acc[range] || 0) + 1;
      return acc;
    }, { '0-5 dias': 0, '6-15 dias': 0, '16-30 dias': 0, '30+ dias': 0 });
    
    return Object.keys(daysDistribution).map(key => ({
      name: key,
      Reenvios: daysDistribution[key]
    }));
  }, [filteredData]);

  // 1. Auxiliares da Coorte
  const cohortMatrix = useMemo(() => {
    const formatMonthKey = (dateStr) => {
      if (!dateStr || dateStr === 'N/A') return null;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`; // YYYY-MM
    };

    const matrix = {};
    const rowMonthsSet = new Set();
    const colMonthsSet = new Set();
    let maxCellValue = 0;

    validData.forEach(item => {
      const oMonth = formatMonthKey(item.data_criacao_original);
      const rMonth = formatMonthKey(item.data_criacao_reenvio);
      if (!oMonth || !rMonth) return;

      rowMonthsSet.add(oMonth);
      colMonthsSet.add(rMonth);

      let val = 0;
      if (cohortMetric === 'receita') {
        val = parseCurrencyValue(item.total_amount);
      } else if (cohortMetric === 'frete') {
        val = parseCurrencyValue(item.frete);
      } else {
        val = 1; // quantidade
      }

      if (!matrix[oMonth]) matrix[oMonth] = {};
      matrix[oMonth][rMonth] = (matrix[oMonth][rMonth] || 0) + val;
    });

    const rows = Array.from(rowMonthsSet).sort();
    const cols = Array.from(colMonthsSet).sort();

    const rowTotals = {};
    const colTotals = {};
    let grandTotal = 0;

    rows.forEach(r => {
      rowTotals[r] = 0;
      cols.forEach(c => {
        const val = matrix[r]?.[c] || 0;
        rowTotals[r] += val;
        colTotals[c] = (colTotals[c] || 0) + val;
        grandTotal += val;
        if (val > maxCellValue) {
          maxCellValue = val;
        }
      });
    });

    return {
      matrix,
      rows,
      cols,
      rowTotals,
      colTotals,
      grandTotal,
      maxCellValue
    };
  }, [validData, cohortMetric]);

  const getCellBgStyle = (value, maxVal) => {
    if (!value || maxVal === 0) return {};
    const opacity = 0.05 + (value / maxVal) * 0.75;
    return {
      background: `rgba(38, 89, 165, ${opacity})`,
      color: opacity > 0.45 ? '#ffffff' : 'var(--text-primary)',
      fontWeight: '600'
    };
  };

  const formatCohortValue = (val) => {
    if (val === undefined || val === null || val === 0) return '-';
    if (cohortMetric === 'quantidade') {
      return new Intl.NumberFormat('pt-BR').format(val);
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val);
  };

  // Configuração do Ordenamento
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = 'default';
    }
    setSortConfig({ key: direction === 'default' ? null : key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className={styles.sortIcon} />;
    if (sortConfig.direction === 'asc') return <ArrowUp size={14} className={styles.sortIcon} style={{ color: 'var(--accent-primary)' }} />;
    return <ArrowDown size={14} className={styles.sortIcon} style={{ color: 'var(--accent-primary)' }} />;
  };

  const getSortLabel = (col) => {
    if (sortConfig.key !== col.key) return '';
    const isNumeric = col.key === 'total_amount' || col.key === 'frete' || col.key === 'dias_entre_envios';
    const isDate = col.key.startsWith('data_');
    
    if (sortConfig.direction === 'asc') {
      if (isNumeric) return 'Crescente';
      if (isDate) return 'Antigas';
      return 'A-Z';
    } else if (sortConfig.direction === 'desc') {
      if (isNumeric) return 'Decrescente';
      if (isDate) return 'Recentes';
      return 'Z-A';
    }
    return '';
  };

  // Gerar dias para a visualização do calendário customizado
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayIndex = new Date(year, month, 1).getDay(); // Dia da semana em que começa o mês
    const totalDays = new Date(year, month + 1, 0).getDate(); // Dias no mês
    
    const days = [];
    // Espaços vazios do início da semana
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Dias do mês
    for (let d = 1; d <= totalDays; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentMonth]);

  const changeMonth = (offset) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  // Clique de Seleção de Dia no Calendário
  const handleDayClick = (day) => {
    if (!day) return;
    setActiveQuickFilter('');
    
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(day);
      setTempEndDate(null);
    } else if (tempStartDate && !tempEndDate) {
      if (day < tempStartDate) {
        setTempStartDate(day);
      } else {
        setTempEndDate(day);
      }
    }
  };

  // Verificar se o dia está selecionado ou no intervalo
  const getDayClass = (day) => {
    if (!day) return styles.dayEmpty;
    
    const tStart = tempStartDate ? new Date(tempStartDate).setHours(0,0,0,0) : null;
    const tEnd = tempEndDate ? new Date(tempEndDate).setHours(0,0,0,0) : null;
    const dTime = day.getTime();
    
    if (dTime === tStart) {
      return `${styles.daySelected} ${tEnd && tStart !== tEnd ? styles.daySelectedStart : ''}`;
    }
    if (dTime === tEnd) {
      return `${styles.daySelected} ${styles.daySelectedEnd}`;
    }
    
    if (tStart && tEnd && dTime > tStart && dTime < tEnd) {
      return styles.dayInRange;
    }
    
    return '';
  };

  // Filtros Rápidos com aplicação imediata e fechamento do Popover
  const applyQuickFilter = (type) => {
    setActiveQuickFilter(type);
    
    if (type === 'tudo') {
      setTempStartDate(null);
      setTempEndDate(null);
      setFilterStartDate(null);
      setFilterEndDate(null);
      setIsCalendarOpen(false);
      return;
    }

    const today = new Date(2026, 4, 22); // Fixando hoje em 22/05/2026 para corresponder aos dados reais da extração
    let start = new Date(today);
    let end = new Date(today);

    switch(type) {
      case 'hoje':
        break;
      case '7dias':
        start.setDate(today.getDate() - 7);
        break;
      case 'semana':
        // Achar início da semana (domingo)
        start.setDate(today.getDate() - today.getDay());
        break;
      case 'mes':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
    }
    
    setTempStartDate(start);
    setTempEndDate(end);
    setFilterStartDate(start);
    setFilterEndDate(end);
    setIsCalendarOpen(false);
  };


  // Confirmar e Filtrar dados
  const applyFilters = () => {
    setFilterStartDate(tempStartDate);
    setFilterEndDate(tempEndDate);
    setIsCalendarOpen(false);
  };

  // Resetar Período
  const clearFilters = () => {
    setTempStartDate(null);
    setTempEndDate(null);
    setFilterStartDate(null);
    setFilterEndDate(null);
    setActiveQuickFilter('');
  };

  const getFilterText = () => {
    if (filterStartDate && filterEndDate) {
      return `${filterStartDate.toLocaleDateString('pt-BR')} até ${filterEndDate.toLocaleDateString('pt-BR')}`;
    }
    if (filterStartDate) {
      return `A partir de ${filterStartDate.toLocaleDateString('pt-BR')}`;
    }
    if (filterEndDate) {
      return `Até ${filterEndDate.toLocaleDateString('pt-BR')}`;
    }
    return 'Selecione o intervalo de datas';
  };

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      
      if (start === 1) {
        end = 5;
      } else if (end === totalPages) {
        start = totalPages - 4;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard de Reenvios</h1>
          <p className={styles.subtitle}>Gogroup / Gocase Performance Analysis</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.brandSelectorGroup}>
            <label htmlFor="header-brand-select" className={styles.brandSelectorLabel}>Marca Ativa</label>
            <select
              id="header-brand-select"
              value={selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className={styles.brandSelectorSelect}
              disabled={loading || isSyncing}
            >
              <option value="lescent">Lescent</option>
              <option value="aua">Aua</option>
              <option value="bysamia">By Samia</option>
              <option value="kokeshi">Kokeshi</option>
            </select>
          </div>

          <button 
            className={styles.clearButton} 
            onClick={() => fetchData(selectedBrand)} 
            disabled={loading || isSyncing}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Atualizar Planilha
          </button>

          <button 
            className={styles.syncButton} 
            onClick={() => { setIsSyncModalOpen(true); setSyncMessage(null); }} 
            disabled={loading || isSyncing}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <Zap size={16} />
            Disparar Fluxo n8n
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className={styles.tabContainer}>
        <button 
          onClick={() => setActiveTab('geral')}
          className={`${styles.tabButton} ${activeTab === 'geral' ? styles.tabButtonActive : ''}`}
        >
          Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab('coorte')}
          className={`${styles.tabButton} ${activeTab === 'coorte' ? styles.tabButtonActive : ''}`}
        >
          Análise de Coorte
        </button>
      </div>

      {loading ? (
        // Skeleton Loaders
        <>
          <div className={styles.grid}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.card} style={{ height: '110px' }}>
                <div className={styles.skeleton} style={{ width: '60%', height: '18px', marginBottom: '10px' }}></div>
                <div className={styles.skeleton} style={{ width: '80%', height: '32px' }}></div>
              </div>
            ))}
          </div>
          <div className={styles.chartsGrid}>
            <div className={styles.chartCard} style={{ height: '350px' }}><div className={styles.skeleton} style={{ width: '100%', height: '100%' }}></div></div>
            <div className={styles.chartCard} style={{ height: '350px' }}><div className={styles.skeleton} style={{ width: '100%', height: '100%' }}></div></div>
          </div>
        </>
      ) : activeTab === 'geral' ? (
        <>
          {/* Painel de Filtros */}
          <div className={styles.filterSection}>
            <div className={styles.filterGroup} ref={popoverRef}>
              <label>Filtrar por Período</label>
              <div className={styles.dateDisplayInput} onClick={() => setIsCalendarOpen(!isCalendarOpen)}>
                <span>{getFilterText()}</span>
                <Calendar size={18} color="var(--accent-primary)" />
              </div>

              {isCalendarOpen && (
                <div className={styles.calendarPopover}>
                  {/* Sidebar de Atalhos Rápidos */}
                  <div className={styles.calendarSidebar}>
                    <button 
                      onClick={() => applyQuickFilter('hoje')} 
                      className={`${styles.quickFilterBtn} ${activeQuickFilter === 'hoje' ? styles.quickFilterBtnActive : ''}`}
                    >
                      Hoje
                    </button>
                    <button 
                      onClick={() => applyQuickFilter('7dias')} 
                      className={`${styles.quickFilterBtn} ${activeQuickFilter === '7dias' ? styles.quickFilterBtnActive : ''}`}
                    >
                      Últimos 7 dias
                    </button>
                    <button 
                      onClick={() => applyQuickFilter('semana')} 
                      className={`${styles.quickFilterBtn} ${activeQuickFilter === 'semana' ? styles.quickFilterBtnActive : ''}`}
                    >
                      Esta Semana
                    </button>
                    <button 
                      onClick={() => applyQuickFilter('mes')} 
                      className={`${styles.quickFilterBtn} ${activeQuickFilter === 'mes' ? styles.quickFilterBtnActive : ''}`}
                    >
                      Este Mês
                    </button>
                    <button 
                      onClick={() => applyQuickFilter('tudo')} 
                      className={`${styles.quickFilterBtn} ${activeQuickFilter === 'tudo' ? styles.quickFilterBtnActive : ''}`}
                    >
                      Limpar Tudo
                    </button>
                  </div>

                  {/* Área Principal do Calendário */}
                  <div className={styles.calendarMain}>
                    <div className={styles.calendarHeader}>
                      <button onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
                      <span className={styles.monthName}>
                        {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </span>
                      <button onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
                    </div>

                    <div className={styles.calendarGrid}>
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                        <div key={idx} className={styles.weekdayHeader}>{day}</div>
                      ))}
                      {calendarDays.map((day, idx) => (
                        <div 
                          key={idx}
                          onClick={() => handleDayClick(day)}
                          className={`${styles.dayCell} ${getDayClass(day)}`}
                        >
                          {day ? day.getDate() : ''}
                        </div>
                      ))}
                    </div>

                    <div className={styles.calendarActions}>
                      <button className={styles.clearButton} onClick={clearFilters} style={{ height: 'auto', padding: '0.4rem 0.8rem' }}>
                        Resetar
                      </button>
                      <button className={styles.applyButton} onClick={applyFilters}>
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(filterStartDate || filterEndDate) && (
              <button onClick={clearFilters} className={styles.clearButton}>
                Limpar Filtros
              </button>
            )}
          </div>

          {/* Cards de KPIs Dinâmicos */}
          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Total de Reenvios</span>
                <div className={styles.cardIcon}><Package size={20} /></div>
              </div>
              <div className={styles.cardValue}>{kpis.totalReenvios}</div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Receita Afetada</span>
                <div className={styles.cardIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}><DollarSign size={20} /></div>
              </div>
              <div className={styles.cardValue}>
                {formatCurrency(kpis.totalReceita)}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Custo Total de Frete</span>
                <div className={styles.cardIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}><Truck size={20} /></div>
              </div>
              <div className={styles.cardValue}>
                {formatCurrency(kpis.totalFrete)}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span>Média de Dias (Reenvio)</span>
                <div className={styles.cardIcon} style={{ background: 'rgba(229, 39, 60, 0.1)', color: 'var(--accent-secondary)' }}><CalendarClock size={20} /></div>
              </div>
              <div className={styles.cardValue}>
                {kpis.diasEntreEnviosAvg} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>dias</span>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Tempo para Reenvio (Distribuição)</h3>
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDaysDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} />
                    <YAxis stroke="var(--text-secondary)" tick={{fill: 'var(--text-secondary)'}} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: 'var(--glass-border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Bar dataKey="Reenvios" radius={[4, 4, 0, 0]}>
                      {chartDaysDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Top 5 Estados (Reenvios)</h3>
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartStates}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {chartStates.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: 'var(--glass-border)', borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: 'var(--text-secondary)' }}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabela de Dados Expandida e Filtrada */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <h3 className={styles.tableTitle}>Registros de Envios e Reenvios ({filteredData.length})</h3>
            </div>
            
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {TABLE_COLUMNS.map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)}>
                        <div className={styles.thContent}>
                          <span>{col.label}</span>
                          <div className={styles.sortIndicatorGroup}>
                            {getSortIcon(col.key)}
                            {getSortLabel(col) && (
                              <span className={styles.sortLabel}>
                                {getSortLabel(col)}
                              </span>
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={TABLE_COLUMNS.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <tr key={row.external_id_original || idx}>
                        {TABLE_COLUMNS.map(col => {
                          const rawVal = row[col.key];
                          const formattedVal = col.format ? col.format(rawVal) : (rawVal || 'N/A');
                          const isHigh = col.highlight;
                          
                          // Tratar células N/A na data de envio original
                          const isNaDate = col.key === 'data_envio_original' && (!rawVal || rawVal === 'N/A');
                          
                          return (
                            <td 
                              key={col.key}
                              style={isHigh && !isNaDate ? { fontWeight: '600', color: col.key === 'total_amount' ? 'var(--accent-success)' : 'var(--text-primary)' } : {}}
                            >
                              {isNaDate ? (
                                <span className={styles.badgeDanger}>
                                  N/A
                                </span>
                              ) : col.key === 'estado_entrega' && rawVal ? (
                                <span className={`${styles.badge} ${rawVal === 'SP' || rawVal === 'RJ' ? styles.badgeSecondary : ''}`}>
                                  {rawVal}
                                </span>
                              ) : (
                                formattedVal
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Controles de Paginação Inteligente */}
            {sortedData.length > 0 && (
              <div className={styles.paginationWrapper}>
                <div className={styles.paginationInfo}>
                  Mostrando <span>{Math.min(sortedData.length, (currentPage - 1) * itemsPerPage + 1)}</span> a{' '}
                  <span>{Math.min(sortedData.length, currentPage * itemsPerPage)}</span> de{' '}
                  <span>{sortedData.length}</span> registros
                </div>
                
                <div className={styles.paginationControls}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={styles.pageButton}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  
                  {getPageNumbers().map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`${styles.pageNumber} ${currentPage === pageNum ? styles.pageNumberActive : ''}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={styles.pageButton}
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>

                <div className={styles.paginationSelectGroup}>
                  <label>Itens por página</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className={styles.pageSelect}
                  >
                    {[10, 15, 25, 50, 100].map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Análise de Coorte */
        <div className={styles.cohortContainer}>
          <div className={styles.cohortHeaderBlock}>
            <div className={styles.cohortTitleGroup}>
              <h2 className={styles.cohortTitle}>Coorte Gocase - Reenvio</h2>
              <span className={styles.cohortMetaInfo}>
                Gerado em: {new Date().toLocaleDateString('pt-BR')} • Origem: Google Sheets
              </span>
            </div>
            
            <div className={styles.cohortControls}>
              <button 
                className={`${styles.metricBtn} ${cohortMetric === 'receita' ? styles.metricBtnActive : ''}`}
                onClick={() => setCohortMetric('receita')}
              >
                Receita (Total Amount)
              </button>
              <button 
                className={`${styles.metricBtn} ${cohortMetric === 'frete' ? styles.metricBtnActive : ''}`}
                onClick={() => setCohortMetric('frete')}
              >
                Frete
              </button>
              <button 
                className={`${styles.metricBtn} ${cohortMetric === 'quantidade' ? styles.metricBtnActive : ''}`}
                onClick={() => setCohortMetric('quantidade')}
              >
                Quantidade (Reenvios)
              </button>
            </div>
          </div>

          <div className={styles.cohortCard}>
            <div className={styles.cohortTableWrapper}>
              <table className={styles.cohortTable}>
                <thead>
                  <tr>
                    <th className={styles.cohortThMain} rowSpan={2}>
                      Mês do Pedido \ Mês do Reenvio
                    </th>
                    <th className={styles.cohortThColHeader} colSpan={cohortMatrix.cols.length}>
                      Mês do Reenvio
                    </th>
                    <th className={styles.cohortThTotalHeader} rowSpan={2}>
                      TOTAL
                    </th>
                  </tr>
                  <tr>
                    {cohortMatrix.cols.map(col => (
                      <th key={col} className={styles.cohortTh}>
                        {formatMonthPTBR(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortMatrix.rows.map(row => {
                    const rowTotal = cohortMatrix.rowTotals[row] || 0;
                    return (
                      <tr key={row}>
                        <td className={styles.cohortRowHeader}>
                          {formatMonthPTBR(row)}
                        </td>
                        {cohortMatrix.cols.map(col => {
                          const val = cohortMatrix.matrix[row]?.[col] || 0;
                          return (
                            <td 
                              key={col} 
                              className={styles.cohortTd}
                              style={getCellBgStyle(val, cohortMatrix.maxCellValue)}
                              title={`Mês Origem: ${formatMonthPTBR(row)}\nMês Reenvio: ${formatMonthPTBR(col)}\nValor: ${formatCohortValue(val)}`}
                            >
                              {formatCohortValue(val)}
                            </td>
                          );
                        })}
                        <td className={styles.cohortTotalCell}>
                          {formatCohortValue(rowTotal)}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Linha de Totais Verticais */}
                  <tr className={styles.cohortTotalRow}>
                    <td className={styles.cohortRowHeaderTotal}>
                      TOTAL
                    </td>
                    {cohortMatrix.cols.map(col => {
                      const colTotal = cohortMatrix.colTotals[col] || 0;
                      return (
                        <td key={col} className={styles.cohortColTotalCell}>
                          {formatCohortValue(colTotal)}
                        </td>
                      );
                    })}
                    <td className={styles.cohortGrandTotalCell}>
                      {formatCohortValue(cohortMatrix.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sincronização Parametrizada (n8n) */}
      {isSyncModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Zap size={18} className={isSyncing ? 'pulse' : ''} style={{ color: 'var(--accent-secondary)' }} />
                Disparar Fluxo n8n
              </h3>
              <button 
                onClick={() => { if (!isSyncing) setIsSyncModalOpen(false); }}
                className={styles.modalCloseBtn}
                disabled={isSyncing}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSyncSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.syncFormGroup}>
                  <label htmlFor="company-select">Empresa / Marca</label>
                  <select
                    id="company-select"
                    value={syncCompany}
                    onChange={(e) => setSyncCompany(e.target.value)}
                    className={styles.syncSelect}
                    disabled={isSyncing}
                  >
                    <option value="lescent">Lescent</option>
                    <option value="aua">Aua</option>
                    <option value="bysamia">By Samia</option>
                    <option value="kokeshi">Kokeshi</option>
                  </select>
                </div>

                <div className={styles.syncFormGroup}>
                  <label htmlFor="year-select">Ano</label>
                  <select
                    id="year-select"
                    value={syncYear}
                    onChange={(e) => setSyncYear(e.target.value)}
                    className={styles.syncSelect}
                    disabled={isSyncing}
                  >
                    <option value="todos">Todos os Anos</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                  </select>
                </div>

                {syncMessage && (
                  <div className={`${styles.syncStatusBanner} ${syncMessage.type === 'success' ? styles.syncStatusSuccess : styles.syncStatusError}`}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{syncMessage.text}</span>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className={styles.modalCancelBtn}
                  disabled={isSyncing}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.modalSubmitBtn}
                  disabled={isSyncing}
                >
                  {isSyncing ? 'Disparando...' : 'Disparar Fluxo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

