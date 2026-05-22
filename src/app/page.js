'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Package, DollarSign, Truck, CalendarClock, AlertCircle, RefreshCw, 
  ChevronLeft, ChevronRight, Calendar, ArrowUpDown, ArrowUp, ArrowDown 
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sheets');
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

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrar apenas linhas com ID válido
  const validData = useMemo(() => {
    return data.filter(item => item.external_id_original);
  }, [data]);

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
        <button className={styles.clearButton} onClick={fetchData} disabled={loading} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar Dados
        </button>
      </div>

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
      ) : (
        <>
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
      )}
    </div>
  );
}

