import type { WorkspaceRepository } from '../repositories/workspace-repository';
import type { Workspace } from '../../shared/types/index';
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '../../shared/validators/index';

export class WorkspaceService {
  constructor(private workspaceRepo: WorkspaceRepository) {}

  async getWorkspacesByOwner(ownerId: string): Promise<Workspace[]> {
    return this.workspaceRepo.findByOwnerId(ownerId);
  }

  async getWorkspaceById(id: string): Promise<Workspace | null> {
    return this.workspaceRepo.findById(id);
  }

  async getWorkspaceByShareToken(shareToken: string): Promise<Workspace | null> {
    return this.workspaceRepo.findByShareToken(shareToken);
  }

  async createWorkspace(ownerId: string, input: CreateWorkspaceInput): Promise<Workspace> {
    return this.workspaceRepo.create({
      ownerId,
      name: input.name,
    });
  }

  async updateWorkspace(
    id: string,
    userId: string,
    input: UpdateWorkspaceInput
  ): Promise<Workspace | null> {
    const isOwner = await this.workspaceRepo.isOwner(id, userId);
    if (!isOwner) {
      throw new Error('Not authorized to update this workspace');
    }

    return this.workspaceRepo.update(id, input);
  }

  async deleteWorkspace(id: string, userId: string): Promise<boolean> {
    const isOwner = await this.workspaceRepo.isOwner(id, userId);
    if (!isOwner) {
      throw new Error('Not authorized to delete this workspace');
    }

    return this.workspaceRepo.delete(id);
  }

  async regenerateShareToken(id: string, userId: string): Promise<Workspace | null> {
    const isOwner = await this.workspaceRepo.isOwner(id, userId);
    if (!isOwner) {
      throw new Error('Not authorized to regenerate share token');
    }

    return this.workspaceRepo.regenerateShareToken(id);
  }

  async canAccessWorkspace(workspaceId: string, userId: string | null): Promise<boolean> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) return false;

    // Owner can always access
    if (userId && workspace.ownerId === userId) return true;

    // Anyone with a valid workspace ID can access (share link)
    return true;
  }

  async isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
    return this.workspaceRepo.isOwner(workspaceId, userId);
  }
}
