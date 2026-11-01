export enum VolunteerSkill {
  Driving = 'driving',
  Medical = 'medical',
  Logistics = 'logistics',
  Cooking = 'cooking',
  Languages = 'languages',
  Admin = 'admin',
  General = 'general',
  /** Pertenece a una ONG (fork USFQ Galápagos). */
  Ngo = 'ngo',
  /** Pertenece a un organismo estatal (fork USFQ Galápagos). */
  Government = 'government',
}

export enum Availability {
  Immediate = 'immediate',
  ThisWeek = 'this_week',
  Flexible = 'flexible',
}

export enum Vehicle {
  None = 'none',
  Car = 'car',
  Van = 'van',
  Truck = 'truck',
}

export enum VolunteerStatus {
  Available = 'available',
  Assigned = 'assigned',
  Inactive = 'inactive',
}
