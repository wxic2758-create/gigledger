export interface Platform {
  id: string
  name: string
  icon: string
  color: string
}

export const platforms: Platform[] = [
  { id: 'uber', name: 'Uber', icon: '🚗', color: '#000000' },
  { id: 'doordash', name: 'DoorDash', icon: '📦', color: '#FF3008' },
  { id: 'instacart', name: 'Instacart', icon: '🛒', color: '#43B02A' },
  { id: 'lyft', name: 'Lyft', icon: '🚙', color: '#FF00BF' },
  { id: 'amazon', name: 'Amazon Flex', icon: '📦', color: '#FF9900' },
  { id: 'other', name: 'Other', icon: '💼', color: '#64748B' },
]

export function getPlatformById(id: string): Platform {
  return platforms.find(p => p.id === id) || platforms[5]
}
