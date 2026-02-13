import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function useMasterData() {
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => base44.entities.Department.list("sort_order"),
  });

  const { data: clients = [], refetch: refetchClients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("name"),
  });

  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("name"),
  });

  const { data: workCategories = [] } = useQuery({
    queryKey: ["workCategories"],
    queryFn: () => base44.entities.WorkCategory.list("sort_order"),
  });

  const refreshProjects = async () => {
    console.log('🔄 Refreshing projects...');
    const result = await refetchProjects();
    console.log('✅ Projects refreshed:', result.data?.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
    return result;
  };

  const refreshClients = async () => {
    console.log('🔄 Refreshing clients...');
    return await refetchClients();
  };

  return { 
    departments, 
    clients, 
    projects, 
    workCategories,
    refreshProjects,
    refreshClients
  };
}