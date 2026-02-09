import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function useMasterData() {
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => base44.entities.Department.list("sort_order"),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("name"),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list("name"),
  });

  const { data: workCategories = [] } = useQuery({
    queryKey: ["workCategories"],
    queryFn: () => base44.entities.WorkCategory.list("sort_order"),
  });

  return { departments, clients, projects, workCategories };
}