import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Package,
  TestTubes,
  Users,
  ClipboardList,
  FileText,
  Settings,
  UserCog,
  Stethoscope,
  FolderKanban,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'Inventario', url: '/admin/inventory', icon: Package },
  { title: 'Pruebas', url: '/admin/tests', icon: TestTubes },
  { title: 'Pacientes', url: '/admin/patients', icon: Users },
  { title: 'Médicos', url: '/admin/doctores', icon: Stethoscope },
  { title: 'Órdenes', url: '/admin/orders', icon: ClipboardList },
  { title: 'Órdenes por médico', url: '/admin/orders-by-doctor', icon: FolderKanban },
  { title: 'Resultados', url: '/admin/results', icon: FileText },
  { title: 'Usuarios', url: '/admin/usuarios', icon: UserCog, adminOnly: true },
  { title: 'Configuración', url: '/admin/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();

  const [labName, setLabName] = useState('BioAnalítica');
  const [labLogo, setLabLogo] = useState<string | null>(null);
  const [hasLowStock, setHasLowStock] = useState(false);

  useEffect(() => {
    fetchSidebarData();

    const channel = supabase
      .channel('sidebar-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracion_laboratorio' },
        () => fetchSidebarData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactivos' },
        () => fetchSidebarData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSidebarData = async () => {
    try {
      const { data: config, error: configError } = await supabase
        .from('configuracion_laboratorio')
        .select('name, logo')
        .maybeSingle();

      if (configError) {
        console.error('Error cargando configuración del laboratorio:', configError);
      }

      if (config?.name) setLabName(config.name);
      if (config?.logo) {
        setLabLogo(config.logo);
      } else {
        setLabLogo(null);
      }

      const { data: reagents, error: reagentsError } = await supabase
        .from('reactivos')
        .select('current_stock, min_stock');

      if (reagentsError) {
        console.error('Error cargando reactivos:', reagentsError);
      }

      const lowStock = reagents?.some(
        (r) => Number(r.current_stock || 0) <= Number(r.min_stock || 0)
      );

      setHasLowStock(!!lowStock);
    } catch (error) {
      console.error('Error cargando datos del sidebar:', error);
    }
  };

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return user?.role === 'admin';
    }
    return true;
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border shadow-sm shrink-0 flex items-center justify-center">
            {labLogo ? (
              <img
                src={labLogo}
                alt={`Logo de ${labName}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xs">
                LOGO
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm text-sidebar-primary-foreground truncate">
                {labName}
              </h2>
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium">
                {user?.role === 'admin' ? 'Administrador' : 'Laboratorista'}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    tooltip={item.title}
                    className={
                      isActive(item.url)
                        ? 'bg-sidebar-accent text-sidebar-primary font-semibold'
                        : 'hover:bg-sidebar-accent/50'
                    }
                  >
                    <div className="relative">
                      <item.icon
                        className={`w-4 h-4 ${
                          isActive(item.url) ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />

                      {item.title === 'Inventario' && hasLowStock && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive animate-pulse" />
                      )}
                    </div>

                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}