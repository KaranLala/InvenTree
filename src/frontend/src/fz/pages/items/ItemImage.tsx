import { Button, FileButton, Group, Image, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPhotoUp, IconTrash } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import { useApi } from '../../../contexts/ApiContext';
import { extractErrorMessage } from '../../api/errors';
import { fzGlobalKey } from '../../api/useBranchQuery';

/**
 * Item image: thumbnail with replace/remove. Upload is a multipart
 * PATCH of the image field alone — axios sets the boundary; core
 * fields go through the separate JSON save.
 */
export default function ItemImage({
  partId,
  image,
  editable
}: {
  partId: number;
  image: string | null | undefined;
  editable: boolean;
}) {
  const api = useApi();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: fzGlobalKey('part', partId) });
    queryClient.invalidateQueries({ queryKey: fzGlobalKey('parts') });
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file, file.name);
      return api.patch(apiUrl(ApiEndpoints.part_list, partId), formData);
    },
    onSuccess: invalidate,
    onError: (error) => {
      notifications.show({
        title: 'Image upload failed',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async () =>
      api.patch(apiUrl(ApiEndpoints.part_list, partId), { image: null }),
    onSuccess: invalidate,
    onError: (error) => {
      notifications.show({
        title: 'Could not remove image',
        message: extractErrorMessage(error),
        color: 'red'
      });
    }
  });

  return (
    <Group align='center' gap='md'>
      <Image
        src={image || '/static/img/blank_image.png'}
        w={96}
        h={96}
        fit='contain'
        radius='sm'
        alt='Item image'
        data-testid='fz-item-image'
      />
      {editable && (
        <Group gap='xs'>
          <FileButton
            onChange={(file) => file && uploadMutation.mutate(file)}
            accept='image/png,image/jpeg,image/webp'
          >
            {(props) => (
              <Button
                {...props}
                size='compact-sm'
                variant='light'
                leftSection={<IconPhotoUp size={16} />}
                loading={uploadMutation.isPending}
              >
                {image ? 'Replace image' : 'Upload image'}
              </Button>
            )}
          </FileButton>
          {image && (
            <Button
              size='compact-sm'
              variant='subtle'
              color='red'
              leftSection={<IconTrash size={16} />}
              onClick={() => removeMutation.mutate()}
              loading={removeMutation.isPending}
            >
              Remove
            </Button>
          )}
        </Group>
      )}
      {!image && (
        <Text size='xs' c='dimmed'>
          Shown in stock and order tables
        </Text>
      )}
    </Group>
  );
}
